'use client';
import { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, BookText } from 'lucide-react';
import { tutorApi, type TutorAnswer } from '../api/tutor-api';
import { PageHeader } from '@/components/common/page-header';
import { MarkdownMath } from '@/components/common/markdown-math';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface ChatTurn { role: 'user' | 'assistant'; content: string; citations?: TutorAnswer['citations']; followUps?: string[]; }

export function TutorChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, busy]);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setInput('');
    setTurns((t) => [...t, { role: 'user', content: message }]);
    setBusy(true);
    try {
      let convId = conversationId;
      if (!convId) {
        const started = await tutorApi.startConversation({ title: message.slice(0, 60), firstMessage: message }) as { conversation: { id: string }; firstAnswer: TutorAnswer | null };
        convId = started.conversation.id;
        setConversationId(convId);
        if (started.firstAnswer) {
          setTurns((t) => [...t, { role: 'assistant', content: started.firstAnswer!.content, citations: started.firstAnswer!.citations, followUps: started.firstAnswer!.followUps }]);
          return;
        }
      }
      const answer = await tutorApi.sendMessage(convId, { message });
      setTurns((t) => [...t, { role: 'assistant', content: answer.content, citations: answer.citations, followUps: answer.followUps }]);
    } catch (err) {
      toast.fromError(err, 'The tutor could not respond');
      setTurns((t) => [...t, { role: 'assistant', content: 'Sorry — I hit an error answering that. Please try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <PageHeader title="AI Tutor" description="Ask anything. Answers are grounded in the CE board knowledge base." />

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {turns.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="h-6 w-6" /></div>
                <p className="mt-3 font-display font-semibold">How can I help you study?</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Try: "Explain the moment-area method" or "What formula gives beam deflection?"</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {['Explain shear and moment diagrams', 'Give me a hint on statics', 'Show a worked example of Mohr\'s circle'].map((s) => (
                    <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>{s}</Button>
                  ))}
                </div>
              </div>
            ) : (
              turns.map((turn, i) => (
                <div key={i} className={cn('flex gap-3', turn.role === 'user' && 'flex-row-reverse')}>
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', turn.role === 'user' ? 'bg-accent/15 text-accent-foreground' : 'bg-primary/10 text-primary')}>
                    {turn.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={cn('max-w-[80%] rounded-lg px-4 py-2.5 text-sm', turn.role === 'user' ? 'bg-primary text-primary-foreground' : 'border bg-card')}>
                    {turn.role === 'assistant'
                      ? <MarkdownMath text={turn.content} />
                      : <p className="whitespace-pre-wrap">{turn.content}</p>}
                    {turn.citations && turn.citations.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {turn.citations.map((c, ci) => (
                          <Badge key={ci} variant="muted" className="gap-1"><BookText className="h-3 w-3" />{c.label.slice(0, 40)}</Badge>
                        ))}
                      </div>
                    ) : null}
                    {turn.followUps && turn.followUps.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {turn.followUps.map((f, fi) => (
                          <button key={fi} onClick={() => send(f)} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary">{f}</button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
            {busy ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Thinking…</div> : null}
            <div ref={endRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 border-t pt-4">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the tutor…" aria-label="Message" disabled={busy} />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
