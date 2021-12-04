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
        netlifyIdentity.refresh().then((jwt)=>console.log("jwt token: " + jwt))
        context.commit('setUser', user);
        netlifyIdentity.close();
        console.log('login event', user);
      }),

      netlifyIdentity.on('logout', () => {
        context.commit('setUser', null);
        console.log('logout event');
      });

      netlifyIdentity.on('init', (user) => {
        context.commit('setUser', user);
        context.commit('setAuthReady', true);
        console.log('init event');
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
