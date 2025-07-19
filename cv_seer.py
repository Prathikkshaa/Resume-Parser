pip install streamlit spacy PyPDF2 python-docx scikit-learn pandas
python -m spacy download en_core_web_sm
streamlit run cv_seer.py
import streamlit as st
import spacy
import re
import PyPDF2
from docx import Document
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd
import uuid

# Load spaCy model
nlp = spacy.load("en_core_web_sm")

# Skill dictionary (extend as needed)
SKILL_DICTIONARY = {
    "python": ["python", "py"],
    "react": ["react", "react.js", "reactjs"],
    "node": ["node.js", "nodejs", "node"],
    "javascript": ["javascript", "js"],
    "sql": ["sql", "mysql", "postgresql"],
    "aws": ["aws", "amazon web services"],
    "django": ["django"],
    "java": ["java"],
    "html": ["html", "html5"],
    "css": ["css", "css3"],
    # Add more skills as needed
}

def extract_text_from_pdf(file):
    try:
        pdf_reader = PyPDF2.PdfReader(file)
        text = ""
        for page in pdf_reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        return text, None
    except Exception as e:
        return None, f"Error parsing PDF: {str(e)}"

def extract_text_from_docx(file):
    try:
        doc = Document(file)
        text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
        return text, None
    except Exception as e:
        return None, f"Error parsing DOCX: {str(e)}"

def extract_text_from_txt(file):
    try:
        text = file.read().decode("utf-8")
        return text, None
    except Exception as e:
        return None, f"Error parsing TXT: {str(e)}"

def extract_text(file):
    if isinstance(file, str):
        return file, None  # For JD text input
    ext = os.path.splitext(file.name)[1].lower()
    if ext == ".pdf":
        return extract_text_from_pdf(file)
    elif ext == ".docx":
        return extract_text_from_docx(file)
    elif ext == ".txt":
        return extract_text_from_txt(file)
    else:
        return None, "Unsupported file format"

def extract_info(text):
    doc = nlp(text)
    
    # Extract name using NER
    name = None
    for ent in doc.ents:
        if ent.label_ == "PERSON" and not name:
            name = ent.text
            break
    if not name:
        name = "Unknown"
    
    # Extract email and phone using regex
    email = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)
    email = email.group() if email else "N/A"
    
    phone = re.search(r"\b(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", text)
    phone = phone.group() if phone else "N/A"
    
    # Extract skills
    skills = []
    for skill, variations in SKILL_DICTIONARY.items():
        for var in variations:
            if re.search(r"\b" + re.escape(var) + r"\b", text, re.IGNORECASE):
                skills.append(skill)
                break
    
    return {"name": name, "email": email, "phone": phone, "skills": skills, "text": text}

def extract_jd_skills(jd_text):
    skills = []
    for skill, variations in SKILL_DICTIONARY.items():
        for var in variations:
            if re.search(r"\b" + re.escape(var) + r"\b", jd_text, re.IGNORECASE):
                skills.append(skill)
                break
    return list(set(skills))

def calculate_score(resume_info, jd_skills, jd_text):
    # Skill score (60% weight)
    matched_skills = [skill for skill in resume_info["skills"] if skill in jd_skills]
    skill_score = len(matched_skills) / len(jd_skills) * 10 if jd_skills else 0
    
    # Thematic relevance score (40% weight)
    vectorizer = TfidfVectorizer(stop_words="english")
    texts = [jd_text, resume_info["text"]]
    tfidf_matrix = vectorizer.fit_transform(texts)
    similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
    relevance_score = similarity * 10
    
    # Final score
    final_score = (0.6 * skill_score + 0.4 * relevance_score)
    final_score = min(max(final_score, 0), 10)  # Clamp between 0 and 10
    
    # Generate summary
    if final_score >= 5:
        summary = [
            f"Strong match for {len(matched_skills)} of {len(jd_skills)} required skills.",
            f"Key skills: {', '.join(matched_skills) if matched_skills else 'None'}.",
            "Relevant experience aligns well with JD requirements.",
            "Candidate demonstrates contextual fit for the role.",
            "Recommended for further evaluation."
        ]
    else:
        missing_skills = [skill for skill in jd_skills if skill not in resume_info["skills"]]
        summary = [
            f"Missing {len(missing_skills)} of {len(jd_skills)} required skills.",
            f"Critical skills absent: {', '.join(missing_skills) if missing_skills else 'None'}.",
            "Limited alignment with JD requirements.",
            "Experience does not fully match job needs.",
            "Not recommended for this role."
        ]
    
    return round(final_score, 2), summary

# Streamlit app
st.set_page_config(page_title="CV Seer", layout="wide")
st.title("CV Seer - Resume Parser")

# Initialize session state
if "jd_text" not in st.session_state:
    st.session_state.jd_text = ""
    st.session_state.results = []
    st.session_state.jd_uploaded = False

# JD Input
st.header("Step 1: Input Job Description")
jd_option = st.radio("JD Input Method", ["Text", "Upload PDF"])
if jd_option == "Text":
    jd_input = st.text_area("Paste Job Description", height=200)
    if st.button("Submit JD"):
        if jd_input:
            st.session_state.jd_text = jd_input
            st.session_state.jd_uploaded = True
            st.success("JD submitted successfully!")
        else:
            st.error("Please provide a job description.")
else:
    jd_file = st.file_uploader("Upload JD (PDF)", type=["pdf"])
    if jd_file and st.button("Submit JD"):
        jd_text, error = extract_text(jd_file)
        if jd_text:
            st.session_state.jd_text = jd_text
            st.session_state.jd_uploaded = True
            st.success("JD uploaded successfully!")
        else:
            st.error(error or "Failed to parse JD.")

# Resume Upload
if st.session_state.jd_uploaded:
    st.header("Step 2: Upload Resumes (Up to 25)")
    resume_files = st.file_uploader("Upload Resumes (PDF, DOCX, TXT)", type=["pdf", "docx", "txt"], accept_multiple_files=True)
    if resume_files and len(resume_files) > 25:
        st.error("Please upload no more than 25 resumes.")
    elif resume_files and st.button("Analyze Resumes"):
        results = []
        jd_skills = extract_jd_skills(st.session_state.jd_text)
        
        for file in resume_files:
            text, error = extract_text(file)
            if not text:
                st.warning(f"Failed to parse {file.name}: {error}")
                continue
            
            resume_info = extract_info(text)
            score, summary = calculate_score(resume_info, jd_skills, st.session_state.jd_text)
            results.append({
                "Name": resume_info["name"],
                "Score": score,
                "Summary": "\n".join(summary)
            })
        
        # Rank results
        results = sorted(results, key=lambda x: x["Score"], reverse=True)
        for i, res in enumerate(results, 1):
            res["Rank"] = i
        
        st.session_state.results = results
        st.success("Analysis complete!")

# Display Results
if st.session_state.results:
    st.header("Results")
    df = pd.DataFrame(st.session_state.results)
    df = df[["Rank", "Name", "Score", "Summary"]]
    st.dataframe(df, use_container_width=True)
    
    # Export to CSV
    csv = df.to_csv(index=False)
    st.download_button("Download Results as CSV", csv, "cv_seer_results.csv", "text/csv")

# Restart Options
if st.session_state.jd_uploaded:
    st.header("Restart Options")
    col1, col2 = st.columns(2)
    with col1:
        if st.button("Restart JD"):
            st.session_state.jd_text = ""
            st.session_state.results = []
            st.session_state.jd_uploaded = False
            st.experimental_rerun()
    with col2:
        if st.button("Restart Parsing"):
            st.session_state.results = []
            st.experimental_rerun()
