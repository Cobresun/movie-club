import netlifyIdentity from 'netlify-identity-widget';

export const authModule = {
  state: {
    user: null,
    ready: false
  },
  mutations: {
    setUser(state: any, value: any) {
      state.user = value;
    },
    setAuthReady(state: any, value: any) {
      state.ready = value;
    },
  },
  actions: {
    init(context: any) {
      netlifyIdentity.on('login', (user) => {
        netlifyIdentity.refresh()
        context.commit('setUser', user);
        netlifyIdentity.close();
      }),

      netlifyIdentity.on('logout', () => {
        context.commit('setUser', null);
      });

      netlifyIdentity.on('init', (user) => {
        context.commit('setUser', user);
        context.commit('setAuthReady', true);
      })

      netlifyIdentity.init({
        APIUrl: "https://cobresun-movie-club.netlify.app/.netlify/identity"
      });
    },
    cleanup() {
      netlifyIdentity.off('login');
      netlifyIdentity.off('logout');
    },
    login() {
      netlifyIdentity.open();
    },
    logout() {
      netlifyIdentity.logout();
    },
  }
}
