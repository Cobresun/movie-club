import netlifyIdentity from 'netlify-identity-widget';

export const authModule = {
  state: {
    user: null,
    authReady: false
  },
  mutators: {
    setUser(state: any, value: any) {
      state.user = value;
    }
  },
  actions: {
    init(context: any) {
      netlifyIdentity.on('login', (user) => {
        context.commit('setUser', user);
        netlifyIdentity.close();

        console.log('login event', user);
      }),

      netlifyIdentity.init();
    },
    login() {
      netlifyIdentity.open();
    },
    logout() {
    },
  }
}
