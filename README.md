# movie-club
[![Netlify Status](https://api.netlify.com/api/v1/badges/1d88681f-226e-4972-a2bb-1360f2610294/deploy-status)](https://app.netlify.com/sites/awesome-kalam-929708/deploys)

## Project setup
```
npm install
npm i netlify-cli -g
```

When developing if you don't see the Login button on the screen, go into your browser console and execute the following command:

`localStorage.setItem("netlifySiteURL", "https://cobresun-movie-club.netlify.app")`

... then refresh the page.

Also when developing use the `cobresunofficial@gmail.com` account.

### Compiles and hot-reloads for development (including Netlify functions)
```
netlify init (authorize with Cobresun Netlify account)
netlify dev
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).
