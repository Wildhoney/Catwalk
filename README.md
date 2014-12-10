# Catwalk

![Travis](http://img.shields.io/travis/Wildhoney/Catwalk.js.svg?style=flat)
&nbsp;
![npm](http://img.shields.io/npm/v/catwalk.js.svg?style=flat)
&nbsp;
![License MIT](http://img.shields.io/badge/License-MIT-lightgrey.svg?style=flat)

* **Bower:** `bower install catwalk`

`Catwalk` is a [CRUD](http://en.wikipedia.org/wiki/Create,_read,_update_and_delete) interface that allows you to [lazy-load](http://en.wikipedia.org/wiki/Lazy_loading) your data. It's written in ES6 and transpiled to ES5 using Google's Traceur module. By using `Catwalk` you interact with simple CRUD events using promises to either `resolve` or `reject` a certain action &ndash; there are absolutely no convoluted methods or sequences that materialised in [Ember Data](https://github.com/emberjs/data).

<img src="http://i.imgur.com/2mGwX42.jpg" width="300" />
---

## Getting Started

With `Catwalk` the first step is to define your collection's blueprint that will explain your eventual data. To define a collection you use the `createCollection` method:

```javascript
var collection = catwalk.createCollection('cats', {
    name: '',
    age: 0
});
```

In the above case we have a collection named `cats` that has two properties: `name` and `age`. When adding models to the `cats` collection, all superfluous properties will be removed &ndash; and required properties added with a default value. We can add a pre-existing model to the collection with the `addModel` (plural: `addModels`) method:

```javascript
var kipperModel = collection.addModel({
    name: 'Kipper',
    age: 17
});
```

*Note:* The difference between `addModel` and `createModel` is that the latter emits an event with a promise &ndash; the `addModel` route assumes the model being added is whole.

With our model added to the `cat` collection we can determine that it exists with `collection.models.length` which should equal **1**:

```javascript
expect(collection.models.length).toEqual(1);
```

To delete the added model we can invoke the `deleteModel` method, which will invoke an event for us &ndash; sending a promise as the second parameter which you **must** resolve or reject accordingly (see [events](#events)):

```javascript
collection.deleteModel(kipperModel);
```

If we don't `resolve` or `reject` the promise for the above action, then the model will be assumed to be deleted locally, but the deletion will not be persisted to the back-end and will therefore return upon refresh &ndash; the events allow us to persist our data using our own custom interface, and to `resolve` or `reject` the promise based on the result of the action &ndash; in cases where there is ` reject` the previous action will be reversed.

## Events

`...`