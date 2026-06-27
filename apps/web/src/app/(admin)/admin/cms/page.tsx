'use client';
import Link from 'next/link';
import { FileText, Library, Sigma, Target, Layers, ClipboardCheck, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent } from '@/components/ui/card';

const SECTIONS = [
  { href: '/admin/questions', label: 'Question Bank', icon: FileText, desc: 'Author and curate questions' },
  { href: '/admin/knowledge', label: 'Knowledge Base', icon: Library, desc: 'Reference documents' },
  { href: '/admin/formulas', label: 'Formula Library', icon: Sigma, desc: 'Engineering formulas' },
  { href: '/admin/learning-objectives', label: 'Learning Objectives', icon: Target, desc: 'Syllabus mapping' },
  { href: '/admin/blueprints', label: 'Blueprints', icon: Layers, desc: 'Exam composition' },
  { href: '/admin/editorial', label: 'Editorial Review', icon: ClipboardCheck, desc: 'Approval workflow' },
  { href: '/admin/ai-generation', label: 'AI Content Gen', icon: Sparkles, desc: 'Generated drafts' },
];

export default function CmsPage() {
  return (
    <div>
      <PageHeader title="Content Management" description="Everything that powers the question experience." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-start gap-3 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                  <div><p className="font-medium">{s.label}</p><p className="text-sm text-muted-foreground">{s.desc}</p></div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
