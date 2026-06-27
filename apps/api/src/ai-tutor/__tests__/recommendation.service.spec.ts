import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecommendationService } from '../services/recommendation.service';

function mocks() {
  const progress = {
    weakTopics: vi.fn().mockResolvedValue([{ topicId: 't-1', subjectId: 's-1', accuracy: 0.4, tier: 'developing' }]),
    getKnowledgeGaps: vi.fn().mockResolvedValue([{ topicId: 't-1', subjectId: 's-1', severity: 'critical', accuracy: 0.4 }]),
  };
  const studentRecs = { recommend: vi.fn().mockResolvedValue([{ questionId: 'q-1' }]) };
  return { progress, studentRecs, svc: new RecommendationService(progress as never, studentRecs as never) };
}

describe('RecommendationService (tutor)', () => {
  let m: ReturnType<typeof mocks>;
  beforeEach(() => { m = mocks(); });

  it('composes weak topics + gaps + recommended questions', async () => {
    const r = await m.svc.smartRecommendations('u-1', { limit: 10 });
    expect(r.focusTopics).toHaveLength(1);
    expect(r.knowledgeGaps).toHaveLength(1);
    expect(r.recommendedQuestions).toHaveLength(1);
    expect(r.rationale).toMatch(/weakest/i);
    expect(m.studentRecs.recommend).toHaveBeenCalledWith('u-1', { limit: 10, subjectId: undefined });
  });

  it('uses a broadening rationale when there are no weak topics', async () => {
    m.progress.weakTopics.mockResolvedValue([]);
    const r = await m.svc.smartRecommendations('u-1');
    expect(r.rationale).toMatch(/broaden/i);
  });
});
