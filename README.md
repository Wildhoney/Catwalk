# Catwalk

![Travis](http://img.shields.io/travis/Wildhoney/Catwalk.js.svg?style=flat)
&nbsp;
![npm](http://img.shields.io/npm/v/catwalk.js.svg?style=flat)
&nbsp;
![License MIT](http://img.shields.io/badge/License-MIT-lightgrey.svg?style=flat)

* **npm:** `npm install catwalk`

`Catwalk` is a [CRUD](http://en.wikipedia.org/wiki/Create,_read,_update_and_delete) interface that allows you to [lazy-load](http://en.wikipedia.org/wiki/Lazy_loading) your data. It's written in ES6 and transpiled to ES5 using Google's Traceur module. By using `Catwalk` you interact with simple CRUD events using promises to either `resolve` or `reject` a certain action &ndash; there are absolutely no convoluted methods or sequences that materialised in [Ember Data](https://github.com/emberjs/data).

<img src="http://i.imgur.com/2mGwX42.jpg" width="300" />
---

## Getting Started

```javascript

// Define a collection specifying its fields and their data-types.
const pets = collection('pets', {
    id:   field(cast.integer(), option.PRIMARY_KEY),
    name: field(cast.string()),
    age:  field(cast.integer())
});

// Subscribe to the updating of any collections.
on(event.SUBSCRIBE, models => {
    console.log(`Oh my goodness... we have ${models.length} pet(s)!`);
});

// Consider the request successful when we create a pet.
on(event.CREATE, ({ model, resolve, reject }) => {
    resolve(model);
});

// Create some pets that need to be either resolved or rejected.
pets.create({ name: 'Miss Kittens', age: 4 });
pets.create({ name: 'Busters', age: 5 });

```
