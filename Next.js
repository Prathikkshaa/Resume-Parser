npm install
```plaintext
resume-screening-app/
├── app/
│   ├── api/
│   │   ├── analyze-jd/
│   │   │   └── route.ts
│   │   ├── upload-resumes/
│   │   │   └── route.ts
│   │   ├── process-batch/
│   │   │   └── route.ts
│   │   ├── export-results/
│   │   │   └── route.ts
│   ├── page.tsx
│   ├── layout.tsx
│   ├── globals.css
│   ├── job-description/
│   │   └── page.tsx
│   ├── upload-resumes/
│   │   └── page.tsx
│   ├── results/
│   │   └── page.tsx
├── components/
│   ├── Header.tsx
│   ├── FileUpload.tsx
│   ├── ResultsTable.tsx
│   ├── CandidateModal.tsx
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   ├── table.tsx
│   │   ├── dialog.tsx
│   │   ├── progress.tsx
│   │   ├── skeleton.tsx
│   │   ├── toast.tsx
│   │   ├── use-toast.ts
├── lib/
│   ├── utils/
│   │   ├── text-extraction.ts
│   │   ├── skill-matching.ts
│   │   ├── scoring.ts
│   │   ├── skills-database.ts
│   │   ├── cosine-similarity.ts
│   ├── types.ts
├── public/
│   ├── favicon.ico
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── next.config.js
├── vercel.json
```

```typescript
// app/layout.tsx
import { ThemeProvider } from 'next-themes';
import { Header } from '@/components/Header';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Header />
          <main className="container mx-auto p-4">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

```typescript
// app/page.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
      <h1 className="text-4xl font-bold mb-4">Resume Screening System</h1>
      <p className="text-lg mb-8 text-center max-w-2xl">
        Streamline your hiring process with our AI-powered resume screening tool. Upload job descriptions and resumes to get detailed candidate analysis and rankings.
      </p>
      <Link href="/job-description">
        <Button size="lg">Get Started</Button>
      </Link>
    </div>
  );
}
```

```typescript
// app/job-description/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { analyzeJobDescription } from '@/lib/utils/skill-matching';

export default function JobDescription() {
  const [jobDescription, setJobDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const skills = await analyzeJobDescription(jobDescription);
      sessionStorage.setItem('jobSkills', JSON.stringify(skills));
      toast({
        title: 'Success',
        description: `Extracted ${skills.length} skills from job description`,
      });
      router.push('/upload-resumes');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to analyze job description',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Enter Job Description</h1>
      <Textarea
        className="min-h-[300px] mb-4"
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        placeholder="Paste the job description here..."
      />
      <Button onClick={handleSubmit} disabled={isLoading || !jobDescription}>
        {isLoading ? 'Analyzing...' : 'Analyze Job Description'}
      </Button>
    </div>
  );
}
```

```typescript
// app/upload-resumes/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUpload } from '@/components/FileUpload';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { processResumes } from '@/lib/utils/text-extraction';

export default function UploadResumes() {
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      if (files.length > 25) {
        throw new Error('Maximum 25 files allowed');
      }
      const results = await processResumes(files);
      sessionStorage.setItem('results', JSON.stringify(results));
      toast({
        title: 'Success',
        description: `Processed ${results.length} resumes`,
      });
      router.push('/results');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process resumes',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Upload Resumes</h1>
      <FileUpload onFilesChange={setFiles} />
      <Button
        onClick={handleAnalyze}
        disabled={isLoading || files.length === 0}
        className="mt-4"
      >
        {isLoading ? 'Processing...' : 'Analyze Resumes'}
      </Button>
    </div>
  );
}
```

```typescript
// app/results/page.tsx
'use client';
import { useState, useMemo } from 'react';
import { ResultsTable } from '@/components/ResultsTable';
import { CandidateModal } from '@/components/CandidateModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportToCSV } from '@/lib/utils/scoring';

interface Candidate {
  id: string;
  name: string;
  score: number;
  contact: { email: string; phone: string; linkedin?: string; github?: string };
  summary: string;
  skills: string[];
}

export default function Results() {
  const [search, setSearch] = useState('');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  const results: Candidate[] = JSON.parse(sessionStorage.getItem('results') || '[]');

  const filteredResults = useMemo(() => {
    return results
      .filter((candidate) =>
        candidate.name.toLowerCase().includes(search.toLowerCase())
      )
      .filter((candidate) => {
        if (scoreFilter === 'all') return true;
        if (scoreFilter === 'high') return candidate.score >= 7;
        if (scoreFilter === 'medium') return candidate.score >= 5 && candidate.score < 7;
        return candidate.score < 5;
      });
  }, [search, scoreFilter, results]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between mb-4">
        <Input
          placeholder="Search candidates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="space-x-2">
          <Button onClick={() => setScoreFilter('all')}>All</Button>
          <Button onClick={() => setScoreFilter('high')}>High (≥7)</Button>
          <Button onClick={() => setScoreFilter('medium')}>Medium (5-6.9)</Button>
          <Button onClick={() => setScoreFilter('low')}>Low (<5)</Button>
          <Button onClick={() => exportToCSV(results)}>Export CSV</Button>
        </div>
      </div>
      <ResultsTable
        data={filteredResults}
        onRowClick={setSelectedCandidate}
      />
      {selectedCandidate && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </div>
  );
}
```

```typescript
// components/Header.tsx
'use client';
import { useTheme } from 'next-themes';
import { Button } from './ui/button';
import { Moon, Sun } from 'lucide-react';
import Link from 'next/link';

export function Header() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          Resume Screening
        </Link>
        <Button
          variant="ghost"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </div>
    </header>
  );
}
```

```typescript
// components/FileUpload.tsx
'use client';
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useToast } from './ui/use-toast';

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
}

export function FileUpload({ onFilesChange }: FileUploadProps) {
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(file => {
      const isValidType = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(file.type);
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      if (!isValidType) {
        toast({
          title: 'Invalid file type',
          description: `${file.name} is not a PDF, DOCX, or TXT file`,
          variant: 'destructive',
        });
      }
      if (!isValidSize) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds 10MB limit`,
          variant: 'destructive',
        });
      }
      return isValidType && isValidSize;
    });
    onFilesChange(validFiles);
  }, [onFilesChange, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 25,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center ${
        isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300'
      }`}
    >
      <input {...getInputProps()} />
      <p className="text-lg">
        {isDragActive
          ? 'Drop the resumes here...'
          : 'Drag and drop resumes here, or click to select files (PDF, DOCX, TXT)'}
      </p>
      <p className="text-sm text-gray-500 mt-2">Maximum 25 files, 10MB each</p>
    </div>
  );
}
```

```typescript
// components/ResultsTable.tsx
'use client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { cn } from '@/lib/utils';

interface Candidate {
  id: string;
  name: string;
  score: number;
  contact: { email: string; phone: string; linkedin?: string; github?: string };
  summary: string;
}

interface ResultsTableProps {
  data: Candidate[];
  onRowClick: (candidate: Candidate) => void;
}

export function ResultsTable({ data, onRowClick }: ResultsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rank</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Summary</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((candidate, index) => (
          <TableRow
            key={candidate.id}
            onClick={() => onRowClick(candidate)}
            className="cursor-pointer"
          >
            <TableCell>{index + 1}</TableCell>
            <TableCell>{candidate.name}</TableCell>
            <TableCell
              className={cn(
                candidate.score >= 7 && 'text-green-600',
                candidate.score >= 5 && candidate.score < 7 && 'text-yellow-600',
                candidate.score < 5 && 'text-red-600'
              )}
            >
              {candidate.score.toFixed(1)}
            </TableCell>
            <TableCell>{candidate.contact.email}</TableCell>
            <TableCell>{candidate.summary}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

```typescript
// components/CandidateModal.tsx
'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

interface Candidate {
  id: string;
  name: string;
  score: number;
  contact: { email: string; phone: string; linkedin?: string; github?: string };
  summary: string;
  skills: string[];
}

interface CandidateModalProps {
  candidate: Candidate | null;
  onClose: () => void;
}

export function CandidateModal({ candidate, onClose }: CandidateModalProps) {
  if (!candidate) return null;

  return (
    <Dialog open={!!candidate} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{candidate.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Score: {candidate.score.toFixed(1)}</h3>
            <p className="text-sm text-gray-500">{candidate.summary}</p>
          </div>
          <div>
            <h3 className="font-semibold">Contact</h3>
            <p>Email: {candidate.contact.email}</p>
            <p>Phone: {candidate.contact.phone}</p>
            {candidate.contact.linkedin && <p>LinkedIn: {candidate.contact.linkedin}</p>}
            {candidate.contact.github && <p>GitHub: {candidate.contact.github}</p>}
          </div>
          <div>
            <h3 className="font-semibold">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((skill) => (
                <span
                  key={skill}
                  className="bg-primary/10 text-primary px-2 py-1 rounded text-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

```typescript
// lib/utils/text-extraction.ts
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function extractTextFromFile(file: File): Promise<string> {
  try {
    if (file.type === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfParse(Buffer.from(arrayBuffer));
      return pdf.text;
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } else if (file.type === 'text/plain') {
      return await file.text();
    }
    throw new Error('Unsupported file type');
  } catch (error) {
    throw new Error(`Failed to extract text from ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function extractContactInfo(text: string) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phoneRegex = /\+?[\d\s-]{10,}/;
  const linkedinRegex = /linkedin\.com\/in\/[a-zA-Z0-9-]+/;
  const githubRegex = /github\.com\/[a-zA-Z0-9-]+/;

  return {
    email: text.match(emailRegex)?.[0] || '',
    phone: text.match(phoneRegex)?.[0] || '',
    linkedin: text.match(linkedinRegex)?.[0],
    github: text.match(githubRegex)?.[0],
  };
}

export function extractName(text: string): string {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  
  // Try first non-empty line
  if (lines[0] && !lines[0].match(emailRegex)) {
    return lines[0];
  }
  
  // Try parsing email for name
  const emailMatch = text.match(emailRegex);
  if (emailMatch) {
    const emailName = emailMatch[0].split('@')[0].split('.')[0];
    return emailName.charAt(0).toUpperCase() + emailName.slice(1);
  }
  
  return 'Unknown Candidate';
}

export async function processResumes(files: File[]) {
  const results = [];
  for (const file of files) {
    const text = await extractTextFromFile(file);
    const contact = extractContactInfo(text);
    const name = extractName(text);
    // Implement skill matching and scoring (to be added in process-batch)
    results.push({
      id: crypto.randomUUID(),
      name,
      contact,
      text,
    });
  }
  return results;
}
```

```typescript
// lib/utils/skill-matching.ts
import { SKILLS_DATABASE } from './skills-database';
import { calculateCosineSimilarity } from './cosine-similarity';

export function analyzeJobDescription(text: string): string[] {
  const skills = new Set<string>();
  const normalizedText = text.toLowerCase();

  for (const [skill, variations] of Object.entries(SKILLS_DATABASE)) {
    const skillMatch = variations.some(variation =>
      normalizedText.includes(variation.toLowerCase())
    );
    if (skillMatch) {
      skills.add(skill);
    }
  }

  return Array.from(skills);
}

export function extractResumeSkills(text: string): string[] {
  const skills = new Set<string>();
  const normalizedText = text.toLowerCase();

  for (const [skill, variations] of Object.entries(SKILLS_DATABASE)) {
    const skillMatch = variations.some(variation =>
      normalizedText.includes(variation.toLowerCase())
    );
    if (skillMatch) {
      skills.add(skill);
    }
  }

  return Array.from(skills);
}
```

```typescript
// lib/utils/scoring.ts
import { calculateCosineSimilarity } from './cosine-similarity';

interface Candidate {
  id: string;
  name: string;
  contact: { email: string; phone: string; linkedin?: string; github?: string };
  text: string;
  skills: string[];
}

export function calculateScores(
  candidates: Candidate[],
  jobSkills: string[],
  jobDescription: string
) {
  return candidates.map(candidate => {
    const skillMatchCount = candidate.skills.filter(skill =>
      jobSkills.includes(skill)
    ).length;
    
    const skillMatchScore = (skillMatchCount / jobSkills.length) * 10 * 0.6;
    
    const thematicSimilarity = calculateCosineSimilarity(
      jobDescription,
      candidate.text
    ) * 10 * 0.4;
    
    const totalScore = Math.min(skillMatchScore + thematicSimilarity, 10);
    
    const summary = generateSummary(totalScore, candidate.skills, jobSkills);
    
    return {
      ...candidate,
      score: totalScore,
      summary,
    };
  });
}

function generateSummary(score: number, candidateSkills: string[], jobSkills: string[]): string {
  const matchedSkills = candidateSkills.filter(skill => jobSkills.includes(skill));
  const missingSkills = jobSkills.filter(skill => !candidateSkills.includes(skill));
  
  if (score >= 5) {
    return `Why YES: Strong candidate with relevant skills including ${matchedSkills.slice(0, 3).join(', ')}. 
      Demonstrates proficiency in key areas. ${missingSkills.length > 0 ? `Could improve in ${missingSkills[0]}.` : ''}`;
  } else {
    return `Why NO: Candidate lacks critical skills such as ${missingSkills.slice(0, 3).join(', ')}. 
      Limited relevant experience detected. Consider for other roles.`;
  }
}

export function exportToCSV(candidates: Candidate[]) {
  const headers = ['Rank', 'Name', 'Score', 'Email', 'Phone', 'LinkedIn', 'GitHub', 'Summary'];
  const rows = candidates.map((candidate, index) => [
    index + 1,
    candidate.name,
    candidate.score.toFixed(1),
    candidate.contact.email,
    candidate.contact.phone,
    candidate.contact.linkedin || '',
    candidate.contact.github || '',
    candidate.summary.replace(/\n/g, ' '),
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'candidates.csv';
  a.click();
  window.URL.revokeObjectURL(url);
}
```

```typescript
// lib/utils/cosine-similarity.ts
export function calculateCosineSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\W+/).filter(word => word.length > 2);
  const words2 = text2.toLowerCase().split(/\W+/).filter(word => word.length > 2);
  
  const allWords = new Set([...words1, ...words2]);
  const vector1 = Array.from(allWords).map(word => words1.filter(w => w === word).length);
  const vector2 = Array.from(allWords).map(word => words2.filter(w => w === word).length);
  
  const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
  const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  return dotProduct / (magnitude1 * magnitude2);
}
```

```typescript
// lib/utils/skills-database.ts
export const SKILLS_DATABASE: Record<string, string[]> = {
  'Python': ['python', 'py', 'python3'],
  'JavaScript': ['javascript', 'js', 'es6', 'typescript', 'ts'],
  'Java': ['java', 'jdk', 'jre'],
  'C++': ['c++', 'cpp', 'c plus plus'],
  'React': ['react', 'reactjs', 'react.js'],
  'Angular': ['angular', 'angularjs', 'angular.js'],
  'Vue': ['vue', 'vuejs', 'vue.js'],
  'Node.js': ['node', 'nodejs', 'node.js'],
  'MySQL': ['mysql', 'my sql'],
  'MongoDB': ['mongodb', 'mongo'],
  'PostgreSQL': ['postgresql', 'postgres'],
  'AWS': ['aws', 'amazon web services'],
  'Azure': ['azure', 'microsoft azure'],
  'GCP': ['gcp', 'google cloud platform'],
  'Docker': ['docker', 'container'],
  'Kubernetes': ['kubernetes', 'k8s'],
  'Jenkins': ['jenkins', 'ci/cd'],
  'TensorFlow': ['tensorflow', 'tf'],
  'PyTorch': ['pytorch', 'torch'],
  'Pandas': ['pandas', 'python pandas'],
  'iOS': ['ios', 'swift', 'objective-c'],
  'Android': ['android', 'kotlin', 'android studio'],
  'React Native': ['react native', 'react-native'],
  // Add more skills as needed
};
```

```typescript
// lib/types.ts
export interface ContactInfo {
  email: string;
  phone: string;
  linkedin?: string;
  github?: string;
}

export interface Candidate {
  id: string;
  name: string;
  score: number;
  contact: ContactInfo;
  summary: string;
  skills: string[];
  text: string;
}

export interface AnalysisResult {
  candidates: Candidate[];
}
```

```typescript
// app/api/analyze-jd/route.ts
import { NextResponse } from 'next/server';
import { analyzeJobDescription } from '@/lib/utils/skill-matching';

export async function POST(request: Request) {
  try {
    const { jobDescription } = await request.json();
    if (!jobDescription) {
      return NextResponse.json({ error: 'Job description is required' }, { status: 400 });
    }
    const skills = analyzeJobDescription(jobDescription);
    return NextResponse.json({ skills });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/upload-resumes/route.ts
import { NextResponse } from 'next/server';
import { processResumes } from '@/lib/utils/text-extraction';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    if (!files.length) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }
    const results = await processResumes(files);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/process-batch/route.ts
import { NextResponse } from 'next/server';
import { calculateScores } from '@/lib/utils/scoring';
import { extractResumeSkills } from '@/lib/utils/skill-matching';

export async function POST(request: Request) {
  try {
    const { candidates, jobSkills, jobDescription } = await request.json();
    
    const processedCandidates = candidates.map((candidate: any) => ({
      ...candidate,
      skills: extractResumeSkills(candidate.text),
    }));
    
    const results = calculateScores(processedCandidates, jobSkills, jobDescription);
    
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
```

```typescript
// app/api/export-results/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { candidates } = await request.json();
    const headers = ['Rank', 'Name', 'Score', 'Email', 'Phone', 'LinkedIn', 'GitHub', 'Summary'];
    const rows = candidates.map((candidate: any, index: number) => [
      index + 1,
      candidate.name,
      candidate.score.toFixed(1),
      candidate.contact.email,
      candidate.contact.phone,
      candidate.contact.linkedin || '',
      candidate.contact.github || '',
      candidate.summary.replace(/\n/g, ' '),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row: string[]) => row.join(','))
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=candidates.csv',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
```

```css
// app/globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 47.4% 11.2%;
}

.dark {
  --background: 222.2 47.4% 11.2%;
  --foreground: 0 0% 100%;
}

body {
  @apply bg-background text-foreground;
}
```

```json
// package.json
{
  "name": "resume-screening-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "^18",
    "react-dom": "^18",
    "next-themes": "^0.3.0",
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.8.0",
    "react-dropzone": "^14.2.3",
    "@radix-ui/react-dialog": "^1.1.1",
    "@radix-ui/react-toast": "^1.2.1",
    "@radix-ui/react-button": "^1.1.0",
    "@radix-ui/react-input": "^1.1.0",
    "@radix-ui/react-textarea": "^1.1.0",
    "@radix-ui/react-table": "^1.0.3",
    "lucide-react": "^0.441.0",
    "tailwindcss": "^3.4.10",
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "@types/mammoth": "^1.0.0",
    "@types/pdf-parse": "^1.1.1"
  }
}
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  darkMode: 'class',
}
```

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig
```

```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "app/**",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/"
    }
  ]
}
```

```typescript
// components/ui/button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'underline-offset-4 hover:underline text-primary',
      },
      size: {
        default: 'h-10 py-2 px-4',
        sm: 'h-9 px-3 rounded-md',
        lg: 'h-11 px-8 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

```typescript
// components/ui/input.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
```

```typescript
// components/ui/textarea.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
```

```typescript
// components/ui/table.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-auto">
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-sm', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
```

```typescript
// components/ui/dialog.tsx
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
};
```

```typescript
// components/ui/toast.tsx
import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]',
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default: 'border bg-background text-foreground',
        destructive:
          'destructive group border-destructive bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive',
      className
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600',
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn('text-sm font-semibold', className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-sm opacity-90', className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
```

```typescript
// components/ui/use-toast.ts
'use client';

import * as React from 'react';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast';
import { useToast as useToastPrimitive } from '@radix-ui/react-toast';

export function useToast() {
  const { toasts, toast, dismiss } = useToastPrimitive();

  const wrappedToast = (options: {
    title?: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }) => {
    toast({
      ...options,
      variant: options.variant || 'default',
    });
  };

  return {
    toast: wrappedToast,
    dismiss,
    toasts,
  };
}

export function Toaster() {
  const { toasts } = useToastPrimitive();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, variant, ...props }) => (
        <Toast key={id} variant={variant} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
```

```typescript
// lib/utils/index.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```
