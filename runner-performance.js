/* Each view has its own lifetime. Detached forms cannot write or render a later runner's data. */
window.CadraPerformance = Object.freeze({
  open(host, options) {
    const scope = document.createElement('section');
    scope.className = 'perf';
    const status = document.createElement('p');
    status.className = 'pf-note';
    status.setAttribute('role', 'status');
    status.textContent = 'Loading…';
    scope.append(status);
    host.replaceChildren(scope);
    const controller = new AbortController();
    const ctx = {
      ...options,
      signal: controller.signal,
      root: scope,
      active: () => !controller.signal.aborted && scope.parentNode === host,
      async verify() {
        if (!ctx.active()) throw new Error('This view is closed.');
        const {data, error} = await ctx.client.auth.getUser();
        if (error || data?.user?.id !== ctx.user.id || !ctx.active()) throw new Error('Please sign in again.');
      }
    };
    const loaders = {
      activity: () => import('./runner-performance-detail.js'),
      rankings: () => import('./runner-performance-rankings.js'),
      training: () => import('./runner-performance-training.js')
    };
    async function boot() {
      try {
        const [module] = await Promise.all([loaders[options.view](),ctx.verify()]);
        if (ctx.active()) await module.render(ctx);
      } catch (error) {
        if (!ctx.active()) return;
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'pf-button';
        retry.textContent = 'Try again';
        retry.addEventListener('click', () => { retry.disabled = true; boot(); });
        status.textContent = error.message === 'Please sign in again.' ? error.message : 'This view could not be loaded. Check your connection and try again.';
        scope.replaceChildren(status,retry);
      }
    }
    boot();
    return () => { controller.abort(); scope.remove(); };
  }
});
