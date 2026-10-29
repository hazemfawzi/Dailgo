import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TaskBoard } from '../../src/features/tasks/TaskBoard';
import type { Task } from '../../src/features/tasks/model';
import { createTranslator } from '../../src/i18n/translate';
function Board() {
  const [tasks, setTasks] = useState<Task[]>(
    Array.from({ length: 14 }, (_, i) => ({
      id: String(i),
      title: `Task ${i}`,
      category: 'Personal',
      done: false,
      status: i === 13 ? 'doing' : 'todo',
    })),
  );
  const [, setRemove] = useState<Task | null>(null);
  return (
    <MemoryRouter>
      <TaskBoard
        t={createTranslator('en')}
        tasks={tasks}
        setTasks={setTasks}
        edit={() => {}}
        setRemove={setRemove}
      />
    </MemoryRouter>
  );
}
test('status board bounds the task page, switches states, and clamps pages after completion', async () => {
  const user = userEvent.setup();
  render(<Board />);
  await user.click(screen.getByRole('button', { name: 'Board view' }));
  expect(document.querySelectorAll('.status-board .task-item')).toHaveLength(6);
  await user.click(screen.getByRole('button', { name: 'Next', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Next', exact: true }));
  expect(document.querySelectorAll('.status-board .task-item')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Complete: Task 12', exact: true }));
  expect(document.querySelectorAll('.status-board .task-item')).toHaveLength(6);
  await user.click(document.querySelector<HTMLButtonElement>('.status-doing')!);
  expect(screen.getByRole('button', { name: 'Task 13', exact: true })).toBeTruthy();
  expect(document.querySelectorAll('.status-board .task-item')).toHaveLength(1);
});
