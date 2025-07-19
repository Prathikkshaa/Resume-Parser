import os
import csv
import io
from flask import Flask, render_template, request, jsonify, session, send_file
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import PyPDF2
import docx
import re
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import WordNetLemmatizer
import warnings
warnings.filterwarnings('ignore')

# Download required NLTK data
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
    nltk.download('wordnet', quiet=True)
except:
    pass

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'

class ResumeJobMatcher:
    def __init__(self):
        self.lemmatizer = WordNetLemmatizer()
        try:
            self.stop_words = set(stopwords.words('english'))
        except:
            self.stop_words = set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'are', 'as', 'was', 'with', 'for'])
        
        # Technical skills keywords for better matching
        self.tech_skills = [
            'python', 'java', 'javascript', 'react', 'angular', 'node', 'sql', 'mongodb',
            'aws', 'azure', 'docker', 'kubernetes', 'machine learning', 'data science',
            'flask', 'django', 'spring', 'html', 'css', 'git', 'agile', 'scrum'
        ]
    
    def extract_text_from_pdf(self, file_content):
        """Extract text from PDF file"""
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text()
            return text
        except:
            return ""
    
    def extract_text_from_docx(self, file_content):
        """Extract text from DOCX file"""
        try:
            doc = docx.Document(io.BytesIO(file_content))
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            return text
        except:
            return ""
    
    def preprocess_text(self, text):
        """Clean and preprocess text"""
        # Convert to lowercase
        text = text.lower()
        
        # Remove special characters and digits
        text = re.sub(r'[^a-zA-Z\s]', ' ', text)
        
        # Tokenize
        try:
            tokens = word_tokenize(text)
        except:
            tokens = text.split()
        
        # Remove stopwords and lemmatize
        processed_tokens = []
        for token in tokens:
            if token not in self.stop_words and len(token) > 2:
                try:
                    processed_tokens.append(self.lemmatizer.lemmatize(token))
                except:
                    processed_tokens.append(token)
        
        return ' '.join(processed_tokens)
    
    def extract_skills(self, text):
        """Extract technical skills from text"""
        text_lower = text.lower()
        found_skills = []
        for skill in self.tech_skills:
            if skill in text_lower:
                found_skills.append(skill)
        return found_skills
    
    def calculate_similarity(self, job_description, resumes_data):
        """Calculate similarity between job description and resumes"""
        # Preprocess job description
        processed_jd = self.preprocess_text(job_description)
        
        # Prepare texts for vectorization
        texts = [processed_jd]
        resume_names = []
        
        for resume_data in resumes_data:
            processed_resume = self.preprocess_text(resume_data['text'])
            texts.append(processed_resume)
            resume_names.append(resume_data['name'])
        
        # Create TF-IDF vectors
        try:
            vectorizer = TfidfVectorizer(max_features=1000, ngram_range=(1, 2))
            tfidf_matrix = vectorizer.fit_transform(texts)
            
            # Calculate cosine similarity
            similarity_matrix = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:])
            similarities = similarity_matrix[0]
        except:
            # Fallback to basic word matching if TF-IDF fails
            similarities = []
            jd_words = set(processed_jd.split())
            for resume_data in resumes_data:
                resume_words = set(self.preprocess_text(resume_data['text']).split())
                overlap = len(jd_words.intersection(resume_words))
                total_words = len(jd_words.union(resume_words))
                similarity = overlap / total_words if total_words > 0 else 0
                similarities.append(similarity)
            similarities = np.array(similarities)
        
        # Create results
        results = []
        for i, (similarity, name) in enumerate(zip(similarities, resume_names)):
            score = similarity * 10  # Scale to 0-10
            resume_text = resumes_data[i]['text']
            
            # Generate summary
            summary = self.generate_summary(job_description, resume_text, score)
            
            results.append({
                'name': name,
                'score': round(score, 2),
                'summary': summary
            })
        
        # Sort by score (descending)
        results.sort(key=lambda x: x['score'], reverse=True)
        
        # Add ranks
        for i, result in enumerate(results):
            result['rank'] = i + 1
        
        return results
    
    def generate_summary(self, job_description, resume_text, score):
        """Generate a 5-line summary based on score"""
        jd_skills = self.extract_skills(job_description)
        resume_skills = self.extract_skills(resume_text)
        
        matched_skills = list(set(jd_skills) & set(resume_skills))
        missing_skills = list(set(jd_skills) - set(resume_skills))
        
        if score >= 5:
            summary = f"✅ WHY YES:\n"
            summary += f"• Strong skill alignment with {len(matched_skills)} matching technical skills\n"
            if matched_skills:
                summary += f"• Key matches: {', '.join(matched_skills[:5])}\n"
            summary += f"• High content similarity score of {score:.1f}/10\n"
            summary += f"• Resume demonstrates relevant experience and qualifications\n"
            summary += f"• Recommended for further consideration"
        else:
            summary = f"❌ WHY NO:\n"
            summary += f"• Low similarity score of {score:.1f}/10 indicates poor match\n"
            if missing_skills:
                summary += f"• Missing critical skills: {', '.join(missing_skills[:5])}\n"
            summary += f"• Limited alignment with job requirements\n"
            summary += f"• Only {len(matched_skills)} out of {len(jd_skills)} required skills found\n"
            summary += f"• Not recommended for this position"
        
        return summary

# Initialize the matcher
matcher = ResumeJobMatcher()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload_job_description', methods=['POST'])
def upload_job_description():
    try:
        job_description = request.form.get('job_description', '').strip()
        if not job_description:
            return jsonify({'error': 'Job description is required'}), 400
        
        session['job_description'] = job_description
        return jsonify({'success': True, 'message': 'Job description saved successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/upload_resumes', methods=['POST'])
def upload_resumes():
    try:
        if 'job_description' not in session:
            return jsonify({'error': 'Please upload job description first'}), 400
        
        files = request.files.getlist('resumes')
        if not files:
            return jsonify({'error': 'No files uploaded'}), 400
        
        resumes_data = []
        
        for file in files:
            if file.filename == '':
                continue
                
            file_content = file.read()
            text = ""
            
            # Extract text based on file type
            if file.filename.lower().endswith('.pdf'):
                text = matcher.extract_text_from_pdf(file_content)
            elif file.filename.lower().endswith('.docx'):
                text = matcher.extract_text_from_docx(file_content)
            elif file.filename.lower().endswith('.txt'):
                text = file_content.decode('utf-8', errors='ignore')
            
            if text.strip():
                resumes_data.append({
                    'name': file.filename,
                    'text': text
                })
        
        if not resumes_data:
            return jsonify({'error': 'No valid resume content found'}), 400
        
        # Calculate similarities
        results = matcher.calculate_similarity(session['job_description'], resumes_data)
        
        # Store results in session
        session['results'] = results
        
        return jsonify({
            'success': True,
            'results': results,
            'total_resumes': len(results)
        })
    
    except Exception as e:
        return jsonify({'error': f'Error processing resumes: {str(e)}'}), 500

@app.route('/export_csv')
def export_csv():
    try:
        if 'results' not in session:
            return jsonify({'error': 'No results to export'}), 400
        
        results = session['results']
        
        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(['Rank', 'Name', 'Score', 'Summary'])
        
        # Write data
        for result in results:
            # Clean summary for CSV (remove newlines and special characters)
            clean_summary = result['summary'].replace('\n', ' | ').replace('•', '-')
            writer.writerow([
                result['rank'],
                result['name'],
                result['score'],
                clean_summary
            ])
        
        output.seek(0)
        
        # Create file-like object
        csv_file = io.BytesIO()
        csv_file.write(output.getvalue().encode('utf-8'))
        csv_file.seek(0)
        
        return send_file(
            csv_file,
            mimetype='text/csv',
            as_attachment=True,
            download_name='resume_matching_results.csv'
        )
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/restart_jd')
def restart_jd():
    session.clear()
    return jsonify({'success': True, 'message': 'Session cleared. Ready for new job description.'})

@app.route('/restart_parsing')
def restart_parsing():
    if 'results' in session:
        del session['results']
    return jsonify({'success': True, 'message': 'Ready for new resumes with same job description.'})

# HTML Template (save as templates/index.html)
html_template = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Job Description and Resume Matching System</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        .gradient-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .card-hover {
            transition: transform 0.2s;
        }
        .card-hover:hover {
            transform: translateY(-2px);
        }
        .score-high { color: #28a745; font-weight: bold; }
        .score-medium { color: #ffc107; font-weight: bold; }
        .score-low { color: #dc3545; font-weight: bold; }
        .summary-box {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 10px;
            margin: 10px 0;
            border-radius: 0 8px 8px 0;
        }
        .loading {
            display: none;
        }
        .results-section {
            display: none;
        }
    </style>
</head>
<body>
    <div class="gradient-bg py-5">
        <div class="container">
            <div class="text-center">
                <h1 class="display-4 mb-3">
                    <i class="fas fa-search-plus me-3"></i>
                    Job Description & Resume Matching System
                </h1>
                <p class="lead">AI-powered recruitment assistant for smarter candidate matching</p>
            </div>
        </div>
    </div>

    <div class="container my-5">
        <!-- Step 1: Job Description -->
        <div class="row mb-4">
            <div class="col-12">
                <div class="card card-hover shadow">
                    <div class="card-header bg-primary text-white">
                        <h4><i class="fas fa-briefcase me-2"></i>Step 1: Enter Job Description</h4>
                    </div>
                    <div class="card-body">
                        <form id="jobDescriptionForm">
                            <div class="mb-3">
                                <textarea class="form-control" id="jobDescription" rows="10" 
                                    placeholder="Paste the complete job description here including requirements, qualifications, and responsibilities..."></textarea>
                            </div>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save me-2"></i>Save Job Description
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <!-- Step 2: Resume Upload -->
        <div class="row mb-4">
            <div class="col-12">
                <div class="card card-hover shadow">
                    <div class="card-header bg-success text-white">
                        <h4><i class="fas fa-file-upload me-2"></i>Step 2: Upload Resumes</h4>
                    </div>
                    <div class="card-body">
                        <form id="resumeUploadForm" enctype="multipart/form-data">
                            <div class="mb-3">
                                <input type="file" class="form-control" id="resumeFiles" 
                                    name="resumes" multiple accept=".pdf,.docx,.txt">
                                <div class="form-text">
                                    <i class="fas fa-info-circle me-1"></i>
                                    Supported formats: PDF, DOCX, TXT. You can upload multiple files.
                                </div>
                            </div>
                            <button type="submit" class="btn btn-success" id="uploadBtn">
                                <i class="fas fa-cloud-upload-alt me-2"></i>Upload and Match Resumes
                            </button>
                        </form>
                        
                        <div class="loading mt-3">
                            <div class="d-flex align-items-center">
                                <div class="spinner-border text-primary me-3" role="status"></div>
                                <span>Processing resumes and calculating matches...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Results Section -->
        <div class="results-section">
            <div class="row mb-3">
                <div class="col-12">
                    <div class="d-flex justify-content-between align-items-center">
                        <h3><i class="fas fa-chart-bar me-2"></i>Matching Results</h3>
                        <div>
                            <button class="btn btn-outline-primary me-2" onclick="exportCSV()">
                                <i class="fas fa-download me-1"></i>Export CSV
                            </button>
                            <button class="btn btn-warning me-2" onclick="restartParsing()">
                                <i class="fas fa-redo me-1"></i>New Resumes
                            </button>
                            <button class="btn btn-danger" onclick="restartJD()">
                                <i class="fas fa-refresh me-1"></i>New Job Description
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-12">
                    <div class="card shadow">
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-striped" id="resultsTable">
                                    <thead class="table-dark">
                                        <tr>
                                            <th>Rank</th>
                                            <th>Resume Name</th>
                                            <th>Match Score</th>
                                            <th>Summary</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Alert Messages -->
        <div id="alertContainer"></div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        function showAlert(message, type = 'info') {
            const alertHtml = `
                <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
            document.getElementById('alertContainer').innerHTML = alertHtml;
        }

        function getScoreClass(score) {
            if (score >= 7) return 'score-high';
            if (score >= 4) return 'score-medium';
            return 'score-low';
        }

        function getScoreBadge(score) {
            if (score >= 7) return 'badge bg-success';
            if (score >= 4) return 'badge bg-warning';
            return 'badge bg-danger';
        }

        // Job Description Form
        document.getElementById('jobDescriptionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const jobDescription = document.getElementById('jobDescription').value.trim();
            if (!jobDescription) {
                showAlert('Please enter a job description', 'danger');
                return;
            }

            try {
                const response = await fetch('/upload_job_description', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `job_description=${encodeURIComponent(jobDescription)}`
                });

                const data = await response.json();
                if (data.success) {
                    showAlert('Job description saved successfully!', 'success');
                } else {
                    showAlert(data.error || 'Error saving job description', 'danger');
                }
            } catch (error) {
                showAlert('Error: ' + error.message, 'danger');
            }
        });

        // Resume Upload Form
        document.getElementById('resumeUploadForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fileInput = document.getElementById('resumeFiles');
            if (fileInput.files.length === 0) {
                showAlert('Please select resume files to upload', 'danger');
                return;
            }

            const formData = new FormData();
            for (let file of fileInput.files) {
                formData.append('resumes', file);
            }

            document.querySelector('.loading').style.display = 'block';
            document.getElementById('uploadBtn').disabled = true;

            try {
                const response = await fetch('/upload_resumes', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();
                
                if (data.success) {
                    displayResults(data.results);
                    showAlert(`Successfully processed ${data.total_resumes} resumes!`, 'success');
                } else {
                    showAlert(data.error || 'Error processing resumes', 'danger');
                }
            } catch (error) {
                showAlert('Error: ' + error.message, 'danger');
            } finally {
                document.querySelector('.loading').style.display = 'none';
                document.getElementById('uploadBtn').disabled = false;
            }
        });

        function displayResults(results) {
            const tbody = document.querySelector('#resultsTable tbody');
            tbody.innerHTML = '';

            results.forEach(result => {
                const row = document.createElement('tr');
                const summaryLines = result.summary.split('\\n').map(line => 
                    line.trim()).filter(line => line).join('<br>');
                
                row.innerHTML = `
                    <td><span class="badge bg-secondary">#${result.rank}</span></td>
                    <td>
                        <i class="fas fa-file-alt me-2"></i>
                        <strong>${result.name}</strong>
                    </td>
                    <td>
                        <span class="${getScoreBadge(result.score)}">${result.score}/10</span>
                    </td>
                    <td>
                        <div class="summary-box">
                            <small>${summaryLines}</small>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });

            document.querySelector('.results-section').style.display = 'block';
        }

        async function exportCSV() {
            try {
                const response = await fetch('/export_csv');
                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'resume_matching_results.csv';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    showAlert('Results exported successfully!', 'success');
                } else {
                    showAlert('Error exporting results', 'danger');
                }
            } catch (error) {
                showAlert('Error: ' + error.message, 'danger');
            }
        }

        async function restartParsing() {
            try {
                const response = await fetch('/restart_parsing');
                const data = await response.json();
                if (data.success) {
                    document.querySelector('.results-section').style.display = 'none';
                    document.getElementById('resumeFiles').value = '';
                    showAlert('Ready for new resumes with same job description!', 'info');
                }
            } catch (error) {
                showAlert('Error: ' + error.message, 'danger');
            }
        }

        async function restartJD() {
            try {
                const response = await fetch('/restart_jd');
                const data = await response.json();
                if (data.success) {
                    document.getElementById('jobDescription').value = '';
                    document.getElementById('resumeFiles').value = '';
                    document.querySelector('.results-section').style.display = 'none';
                    showAlert('Session cleared. Ready for new job description!', 'info');
                }
            } catch (error) {
                showAlert('Error: ' + error.message, 'danger');
            }
        }
    </script>
</body>
</html>
'''

# Create templates directory and save HTML
os.makedirs('templates', exist_ok=True)
with open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(html_template)

if __name__ == '__main__':
    print("Job Description and Resume Matching System")
    print("=========================================")
    print("Starting Flask server...")
    print("Open your browser and go to: http://localhost:5000")
    print("\nFeatures:")
    print("✓ Job Description Input")
    print("✓ Multiple Resume Upload (PDF, DOCX, TXT)")
    print("✓ AI-Powered Matching Algorithm")
    print("✓ Score-based Ranking (0-10)")
    print("✓ Detailed Match Summaries")
    print("✓ CSV Export Functionality")
    print("✓ Session Management")
    print("✓ Responsive Web Interface")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
