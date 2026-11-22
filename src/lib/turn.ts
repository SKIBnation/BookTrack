let turn: Promise<unknown> = Promise.resolve()

export function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = turn.then(task, task)
  turn = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
