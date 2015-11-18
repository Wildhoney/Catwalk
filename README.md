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

### Create Collection

Use the `create` function from the `catwalk/collection` module to create your collection's blueprint. At this point you can configure any typecasting rules that will apply to the models contained within in. Relationships are also created at this point, but for the sake of brevity will be covered further down the README.

```javascript
import {create} from 'catwalk/collection';
import {typecast} from 'catwalk/typecast';

// ...

const animals = create({
    name: typecast.string('Unknown'),
    age: typecast.number(5)
});
```

Models are created, read, updated and deleted via the newly created `animals` collection using `create`, `read`, `update` and `delete` methods respectively.

### Create Model

Creating a model is as simple as invoking the `create` method with its associated data &mdash; the `on` event ([see below](#events)) will be fired allowing you to either `resolve` or `reject` the promise &mdash; if no `create` has been defined, then the promise will be resolved automatically.

```javascript
animals.create({ name: 'Kipper', age: 14 });
```

Considering you've configured typecasting on your model's blueprint, the data passed in will undergo typecasting and therefore may differ from what has been supplied. Any superfluous properties will be silently removed from the model's data &ndash; contrariwise if any data is missing then the promise will be summarily rejected.

### Events

You can import `on`, `off` and `once` from the `catwalk/event` module for listening to the CRUD lifecycle events. An object is passed into the `on` function which you can destructure &mdash; items such as `collection`, `resolve`, `reject` are passed in, and the developer is expected to either `resolve` or `reject` the promise depending on whether the request succeeded.

```javascript
import {on, off, once} from 'catwalk/event';

// ...

on('create', ({resolve}) => resolve());
```
