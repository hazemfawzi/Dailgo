import { DateTimeInput } from '../../components/DateTimeInput';
import { useState } from 'react';
import { usePersisted } from '../../lib/storage';
import { localDate } from '../../lib/workspace';
import type { Translate } from '../../lib/workspace';
import { localeFor, formatCalendarDate } from '../../i18n/format';
import { Button } from '../../components/ui/button';
import { cents, emptyFinance } from './model';
import type { Finance } from './model';
export function FinanceScreen({ t }: { t: Translate }) {
  const [finance, setFinance, error] = usePersisted<Finance>(
    'personal-os.finance.v1',
    emptyFinance,
  );
  const [currency, setCurrency] = useState('EGP');
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [notice, setNotice] = useState('');
  const money = (value: number, code = currency) =>
    new Intl.NumberFormat(localeFor(t('en', 'ar')), { style: 'currency', currency: code }).format(
      value / 100,
    );
  const expenses = finance.expenses.filter(
    (x) => x.currency === currency && x.date.startsWith(month),
  );
  const spent = expenses.reduce((total, x) => total + x.cents, 0);
  const budget = finance.budgets[month + '/' + currency];
  return (
    <section className="card tools-section">
      <h2 dir="auto">{t('ui.savingsAndMonthlyExpenses.8a0680')}</h2>
      <p dir="auto">{t('ui.manualRecordsOnlyNoBankConnectionOr.598ecb')}</p>
      <div className="editor-form form-pair">
        <label>
          {t('ui.currency.7e404e')}
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {['EGP', 'SAR', 'AED', 'KWD', 'USD', 'EUR'].map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
        <label>
          {t('ui.expenseMonth.2a6a8b')}
          <input type="month" value={month} onInput={(e) => setMonth(e.currentTarget.value)} />
        </label>
      </div>
      <p dir="auto">
        {t('ui.spent.b2d9cd')}: {money(spent)} · {t('ui.budget.c0cd32')}:{' '}
        {budget === undefined ? t('ui.notSet.e12116') : money(budget)}
      </p>
      {budget !== undefined && spent > budget && (
        <p dir="auto" role="status">
          {t('ui.monthlyBudgetExceeded.c08e29')}
        </p>
      )}
      <form
        className="editor-form tools-inline"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const fields = new FormData(e.currentTarget);
            const value = cents(String(fields.get('budget')));
            setFinance((old) => ({
              ...old,
              budgets: { ...old.budgets, [month + '/' + currency]: value },
            }));
          } catch {
            setNotice(t('ui.enterAValidAmount.e82186'));
          }
        }}
      >
        <label>
          {t('ui.monthlyBudget.32263c')}
          <input name="budget" type="number" min={0} max={100000000} step="0.01" required />
        </label>
        <Button>{t('ui.saveBudget.9f0219')}</Button>
      </form>
      <form
        className="editor-form tools-inline"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          try {
            const fields = new FormData(form);
            const item = {
              id: crypto.randomUUID(),
              title: String(fields.get('title')).trim(),
              date: String(fields.get('date')),
              cents: cents(String(fields.get('amount'))),
              currency,
            };
            if (!item.title || !item.cents) throw Error();
            setFinance((old) => ({ ...old, expenses: [...old.expenses, item] }));
            form.reset();
          } catch {
            setNotice(t('ui.reviewTheExpenseTitleDateAndAmount.af321c'));
          }
        }}
      >
        <label>
          {t('ui.expenseTitle.0cac68')}
          <input name="title" dir="auto" maxLength={160} required />
        </label>
        <label>
          {t('ui.expenseDate.5a01c5')}
          <DateTimeInput
            name="date"
            type="date"
            defaultValue={localDate()}
            required
            aria-label={t('ui.expenseDate.5a01c5')}
          />
        </label>
        <label>
          {t('ui.amount.996f6b')}
          <input name="amount" type="number" min="0.01" max={100000000} step="0.01" required />
        </label>
        <Button>{t('ui.addExpense.00e463')}</Button>
      </form>
      <ul className="tools-records">
        {expenses.map((item) => (
          <li key={item.id}>
            <span dir="auto">{item.title}</span>
            <time dateTime={item.date}>{formatCalendarDate(item.date, t('en', 'ar'))}</time>
            <bdi>{money(item.cents)}</bdi>
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm(t('ui.deleteThisExpense.23c8de')))
                  setFinance((old) => ({
                    ...old,
                    expenses: old.expenses.filter((x) => x.id !== item.id),
                  }));
              }}
            >
              {t('ui.deleteExpense.6b88fe')}
            </Button>
          </li>
        ))}
      </ul>
      {!expenses.length && <p dir="auto">{t('ui.addAnExpenseToUnderstandThisMonth.71f891')}</p>}
      <h3 dir="auto">{t('ui.savingsGoals.6de84e')}</h3>
      <form
        className="editor-form tools-inline"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          try {
            const f = new FormData(form);
            const target = cents(String(f.get('target')));
            if (!target) throw Error();
            setFinance((old) => ({
              ...old,
              savings: [
                ...old.savings,
                {
                  id: crypto.randomUUID(),
                  title: String(f.get('title')).trim(),
                  target,
                  saved: 0,
                  currency,
                },
              ],
            }));
            form.reset();
          } catch {
            setNotice(t('ui.enterATitleAndAPositiveTarget.77267f'));
          }
        }}
      >
        <label>
          {t('ui.savingGoalName.70c199')}
          <input name="title" maxLength={160} required dir="auto" />
        </label>
        <label>
          {t('ui.targetAmount.64ad1e')}
          <input name="target" type="number" min="0.01" max={100000000} step="0.01" required />
        </label>
        <Button>{t('ui.addSavingsGoal.d7acf1')}</Button>
      </form>
      {finance.savings.map((goal) => (
        <section className="saving-goal" key={goal.id}>
          <h4 dir="auto">{goal.title}</h4>
          <p dir="auto">
            {money(goal.saved, goal.currency)} / {money(goal.target, goal.currency)}
          </p>
          <progress max={goal.target} value={Math.min(goal.saved, goal.target)} />
          <form
            className="editor-form tools-inline"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              try {
                const amount = cents(String(new FormData(form).get('amount')));
                setFinance((old) => ({
                  ...old,
                  savings: old.savings.map((x) =>
                    x.id === goal.id ? { ...x, saved: x.saved + amount } : x,
                  ),
                }));
                form.reset();
              } catch {
                setNotice(t('ui.enterAValidAmount.e82186'));
              }
            }}
          >
            <label>
              {t('ui.recordSavedAmount.9b24cd')}
              <input name="amount" type="number" min="0.01" max={100000000} step="0.01" required />
            </label>
            <Button>{t('ui.recordDeposit.df8f00')}</Button>
          </form>
        </section>
      ))}
      {notice && (
        <p dir="auto" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p dir="auto" role="alert">
          {t('ui.savingFailedReconnectBeforeChangingFinancialRecords.feb56d')}
        </p>
      )}
    </section>
  );
}
