/**
 * @file question-mapper.service.spec.ts
 * @module Questions/Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { QuestionMapperService } from '../services/question-mapper.service';

const choiceRow = (letter: string, isCorrect = false) => ({
  choiceLetter: letter, choiceText: `Choice ${letter}`, choiceLatex: null, choiceHtml: null,
  isCorrect, explanation: null, sortOrder: 0,
});

const q = {
  id: 'q-1', questionCode: 'HYD-001', subjectId: 's-1', topicId: 't-1', subtopicId: 'st-1',
  difficultyLevelId: 'd-1', stemText: 'stem', stemLatex: 'L', stemHtml: 'H', correctChoice: 'B',
  explanationText: 'exp', explanationLatex: null, explanationHtml: null, questionStatus: 'in_review',
  bloomLevel: 'apply', questionType: 'multiple_choice', learningObjective: 'LO', prcSyllabusRef: 'REF',
  estSolvingTimeSec: 120, language: 'en', authorId: 'author-1', reviewerId: 'rev-1', publishedBy: null,
  currentVersion: 3, isPrcVerified: true, isAiGenerated: false, publishedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-02T00:00:00Z'),
  choices: [choiceRow('B', true), choiceRow('A'), choiceRow('D'), choiceRow('C')],
  questionTags: [{ tagId: 'tag-1' }, { tagId: 'tag-2' }],
};

describe('QuestionMapperService', () => {
  let mapper: QuestionMapperService;
  beforeEach(() => { mapper = new QuestionMapperService(); });

  describe('toSummary()', () => {
    it('maps core fields and ISO-formats dates', () => {
      const s = mapper.toSummary(q, ['tag-1']);
      expect(s.id).toBe('q-1');
      expect(s.status).toBe('in_review');
      expect(s.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(s.tags).toEqual(['tag-1']);
      expect(s.publishedAt).toBeNull();
    });
  });

  describe('toDetail()', () => {
    it('includes full content and sorts choices alphabetically', () => {
      const d = mapper.toDetail(q, 'educational');
      expect(d.choices.map((c) => c.letter)).toEqual(['A', 'B', 'C', 'D']);
      expect(d.correctChoice).toBe('B');
      expect(d.reviewStage).toBe('educational');
      expect(d.tags).toEqual(['tag-1', 'tag-2']);
      expect(d.learningObjective).toBe('LO');
    });

    it('passes through a null review stage', () => {
      const d = mapper.toDetail({ ...q, questionStatus: 'published' }, null);
      expect(d.reviewStage).toBeNull();
    });
  });

  describe('buildSnapshot()', () => {
    it('captures content + choices + stage for versioning', () => {
      const snap = mapper.buildSnapshot(q, 'qa');
      expect(snap.stemText).toBe('stem');
      expect(snap.correctChoice).toBe('B');
      expect(snap.choices).toHaveLength(4);
      expect(snap.reviewStage).toBe('qa');
      expect(snap.subjectId).toBe('s-1');
    });
  });
});
