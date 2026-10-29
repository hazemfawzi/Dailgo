import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DateTimeInput } from '../../src/components/DateTimeInput';
import { WeeklyGuided } from '../../src/features/journey/WeeklyGuided';
import { createTranslator } from '../../src/i18n/translate';
const state = vi.hoisted(() => ({
  data: { 'personal-os.language': 'ar' } as Record<string, unknown>,
  write: vi.fn(),
}));
vi.mock('../../src/lib/storage', () => ({
  useStorageState: () => ({ data: state.data }),
  transactData: (fn: (data: Record<string, unknown>) => unknown) => state.write(fn),
}));
beforeEach(() => {
  state.data = { 'personal-os.language': 'ar' };
  state.write.mockReset();
  state.write.mockImplementation(async (fn) => {
    state.data = fn(state.data);
    return true;
  });
});
test('date controls show readable Arabic while submitting the standard calendar value', () => {
  const values: string[] = [];
  render(
    <DateTimeInput
      type="date"
      aria-label="Day"
      value="2026-10-28"
      onChange={(event) => values.push(event.currentTarget.value)}
    />,
  );
  expect((screen.getByLabelText('Day') as HTMLInputElement).value).toBe('28/10/2026');
  expect(screen.getByText('28 أكتوبر 2026')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-11-02' } });
  expect(values).toEqual(['2026-11-02']);
});
test('time controls preserve their machine value and empty controls do not show a fabricated date', () => {
  const { rerender } = render(
    <DateTimeInput type="time" aria-label="Time" value="20:00" readOnly />,
  );
  expect(screen.getByText('20:00')).toBeTruthy();
  expect((screen.getByLabelText('Time') as HTMLInputElement).value).toBe('20:00');
  rerender(<DateTimeInput type="date" aria-label="Day" value="" readOnly />);
  expect(screen.queryByText(/2026/)).toBeNull();
});
test('weekly review reveals one step at a time and preserves a draft until explicit save', async () => {
  state.data = {
    'personal-os.language': 'en',
    'personal-os.tasks.v1': [],
    'personal-os.entries.v1': { version: 2, demoVersion: 1, entries: [] },
  };
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <WeeklyGuided start="2026-10-26" t={createTranslator('en')} />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('img')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Next review step' }));
  expect(screen.getByRole('img', { name: 'Life areas recorded activity radar' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Next review step' }));
  await user.type(screen.getByLabelText('Next week result 1'), 'Walk three times');
  await user.click(screen.getByRole('button', { name: 'Back' }));
  await user.click(screen.getByRole('button', { name: 'Next review step' }));
  expect((screen.getByLabelText('Next week result 1') as HTMLInputElement).value).toBe(
    'Walk three times',
  );
  expect(state.write).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('Next week result 2'), 'Read two chapters');
  await user.type(screen.getByLabelText('Next week result 3'), 'Plan the budget');
  await user.click(screen.getByRole('button', { name: 'Save three results for next week' }));
  expect(state.write).toHaveBeenCalledTimes(1);
  expect(
    (state.data['personal-os.weeks.v1'] as Record<string, { outcomes: { title: string }[] }>)[
      '2026-11-02'
    ].outcomes.map((item) => item.title),
  ).toEqual(['Walk three times', 'Read two chapters', 'Plan the budget']);
});

test('translation catalogues have matching keys and unknown names remain plain text', async () => {
  const en = await import('../../src/i18n/en.json');
  const ar = await import('../../src/i18n/ar.json');
  expect(Object.keys(en.default).sort()).toEqual(Object.keys(ar.default).sort());
  expect(createTranslator('ar')('toString')).toBe('toString');
  expect(createTranslator('en')('constructor')).toBe('constructor');
});

test('Arabic calendar follows week start, rejects impossible dates and enforces range limits', async () => {
  state.data['personal-os.planning.v1'] = { weekStartsOn: 6 };
  const values: string[] = [];
  const user = userEvent.setup();
  render(
    <DateTimeInput
      type="date"
      aria-label="Day"
      value="2026-10-28"
      min="2026-10-27"
      max="2026-10-29"
      onChange={(event) => values.push(event.target.value)}
    />,
  );
  fireEvent.change(screen.getByLabelText('Day'), { target: { value: '٣١/٠٢/٢٠٢٦' } });
  expect(screen.getByRole('alert')).toBeTruthy();
  expect((screen.getByLabelText('Day') as HTMLInputElement).checkValidity()).toBe(false);
  expect(values).toEqual([]);
  fireEvent.change(screen.getByLabelText('Day'), { target: { value: '٢٩/١٠/٢٠٢٦' } });
  expect(values).toEqual(['2026-10-29']);
  await user.click(screen.getByRole('button', { name: 'اختار التاريخ' }));
  const blocked = screen.getByRole('button', { name: '26 أكتوبر 2026' });
  expect((blocked as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole('button', { name: '27 أكتوبر 2026' }));
  expect(values).toEqual(['2026-10-29', '2026-10-27']);
});

test('Arabic controls submit ISO values for uncontrolled form fields', () => {
  render(
    <form data-testid="date-form">
      <DateTimeInput name="date" type="date" defaultValue="2026-10-28" aria-label="Day" />
    </form>,
  );
  const form = screen.getByTestId('date-form') as HTMLFormElement;
  expect(new FormData(form).get('date')).toBe('2026-10-28');
  fireEvent.change(screen.getByLabelText('Day'), { target: { value: '٢٩/١٠/٢٠٢٦' } });
  expect(new FormData(form).get('date')).toBe('2026-10-29');
});

test('Arabic interface numbers use Latin digits while Arabic date labels and parsing remain available', async () => {
  const { formatNumber, formatCalendarDate, formatDuration } =
    await import('../../src/i18n/format');
  expect(formatNumber(1234.5, 'ar')).toBe('1,234.5');
  expect(formatDuration(65, 'ar')).toBe('1:05');
  expect(formatCalendarDate('2026-10-29', 'ar')).toBe('29 أكتوبر 2026');
  expect(createTranslator('ar')('ui.clarityOfNextStep15.29ce32')).not.toMatch(/[٠-٩۰-۹]/);
});
