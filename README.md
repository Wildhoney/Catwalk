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

```javascript
import {create} from 'catwalk/collection';
import {typecast} from 'catwalk/typecast';

// ...

const animals = create({
    name: typecast.string('Unknown'),
    age: typecast.number(5)
});
```

### Create Model

```javascript
animals.add({ name: 'Kipper', age: 14 });
```

### Events

```javascript
import {on, off, once} from 'catwalk/event';

// ...

on('create', ({resolve}) => resolve());
```
