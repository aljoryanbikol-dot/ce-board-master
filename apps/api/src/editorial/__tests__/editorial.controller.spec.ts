import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorialController } from '../controllers/editorial.controller';

const editorial = { getStandardsCatalog: vi.fn(), listStandards: vi.fn(), getStandardByBook: vi.fn(), getSections: vi.fn(), searchStandards: vi.fn() };

describe('EditorialController', () => {
  let ctrl: EditorialController;
  beforeEach(() => { vi.clearAllMocks(); ctrl = new EditorialController(editorial as never); });

  it('delegates all endpoints', async () => {
    editorial.getStandardsCatalog.mockReturnValue([]);
    editorial.listStandards.mockResolvedValue([]);
    editorial.getStandardByBook.mockResolvedValue({});
    editorial.getSections.mockResolvedValue([]);
    editorial.searchStandards.mockResolvedValue({ hits: [] });
    ctrl.catalog();
    await ctrl.standards();
    await ctrl.byBook(15);
    await ctrl.sections('d-1');
    await ctrl.search('style', '10');
    expect(editorial.getStandardByBook).toHaveBeenCalledWith(15);
    expect(editorial.getSections).toHaveBeenCalledWith('d-1');
    expect(editorial.searchStandards).toHaveBeenCalledWith('style', 10);
  });
});
