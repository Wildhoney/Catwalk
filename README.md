Catwalk.js
======

Why Catwalk? Because it's jam-packed full of models! Catwalk has engendered from the observations on the plight of <a href="https://github.com/emberjs/data" target="_blank">Ember Data</a>, and instead doesn't even *try* to predict everything &ndash; instead Catwalk.js is more focused on satisfying the <a href="http://en.wikipedia.org/wiki/KISS_principle" target="_blank">KISS principle</a>.

**Friends:** Uses <a href="https://github.com/square/crossfilter" target="_blank">Crossfilter</a>, <a href="http://underscorejs.org/" target="_blank">Underscore</a>, and <a href="https://github.com/kriskowal/q" target="_blank">Q</a> extensively.

<img src="http://fc06.deviantart.net/fs37/i/2008/265/2/8/Cat_silhouette_by_valsgalore.png" />

Catwalk is entirely API agnostic. It doesn't matter whether you're serving your data through JSON, CSV, or your very own custom data format. Catwalk is **only** concerned with creating, reading, updating, and deleting (CRUD).

Creating a Collection
-----

Before you can begin creating models you will need to create collections &ndash; these serve as blueprints for your models.

```javascript
var $cats = $catwalk.collection('cats', {

    /**
     * @property id
     * @type {Number}
     */
    id: $catwalk.attribute.integer,

    /**
     * @property name
     * @type {String}
     */
    name: $catwalk.attribute.string,

    /**
     * @property age
     * @type {Number}
     */
    age : $catwalk.attribute.integer

});
```

In the above example we have defined a `$cats` collection, which has three properties: `id`, `name`, and `age`. Each property can be assigned to a value, or a Catwalk function which will typecast the property for you.

Catwalk has the following *typecastable* functions:

 * `catwalk.attribute.string`
 * `catwalk.attribute.integer`
 * `catwalk.attribute.float`
 * `catwalk.attribute.boolean`

Each collection also needs to know what its primary key is &ndash; this can be defined with the protected `_primaryKey` property.

```javascript
var $cats = $catwalk.collection('cats', {

    /**
     * @property _primaryKey
     * @type {String}
     * @protected
     */
    _primaryKey: 'id',

    /**
     * @property id
     * @type {Number}
     */
    id: $catwalk.attribute.integer,

    /**
     * @property name
     * @type {String}
     */
    name: $catwalk.attribute.string,

    /**
     * @property age
     * @type {Number}
     */
    age : $catwalk.attribute.integer

});
```

Last but not least, each collection can define its relationships to other collections with the protected `_relationships` object.

```javascript
var $cats = $catwalk.collection('cats', {

    /**
     * @property colours
     * @type {Object}
     */
    _relationships: {

        /**
         * @property colours
         * @type {Object}
         */
        colours: $catwalk.relationship.hasMany({
            collection: 'colours',
            foreignKey: 'id'
        })

    },

    /**
     * @property _primaryKey
     * @type {String}
     * @protected
     */
    _primaryKey: 'id',

    /**
     * @property id
     * @type {Number}
     */
    id: $catwalk.attribute.integer,

    /**
     * @property name
     * @type {String}
     */
    name: $catwalk.attribute.string,

    /**
     * @property age
     * @type {Number}
     */
    age : $catwalk.attribute.integer

});
```

In the relationship above we have defined a one-to-many relationship (`hasMany`), but we could also define a one-to-one relationship with `hasOne`. When you access the `colours` property on a model, the actual related colour models will be returned.

Manipulating
-----

<h3>Creating Models</h3>

After you have created a collection, you can begin adding models to your collections. All models can be added with the `createModel` method &ndash; passing in the values of the properties we defined on the collection.

```javascript
var missKittens = $cats.createModel({
    id: 2,
    name: 'Miss Kittens',
    age: 4,
    colours: [1, 2, 3]
});
```

In order for Catwalk to begin mapping the relationship, our model defines the `colours` property with an array of IDs.

<h3>Updating Models</h3>

You can modify any property of a model by using the `updateModel` method. Each and every can be updated, including the relationships.

```javascript
$cats.updateModel(missKittens, {
    name: 'Lucifer',
    colours: [1, 2]
});
```

In the above example we have changed Miss Kittens to Lucifer &ndash; a **very** apt name! We have also updated the relationship to only two colours instead of three.

<h3>Deleting Models</h3>

We can delete models using the `deleteModel` method which accepts one parameter of the model you wish to delete.

```javascript
$cats.deleteModel(missKittens);
```

Updates
-----

Whenever a collection has been updated, the `content` event is invoked. You can watch the `content` event with the `watch` method &ndash; which is the same method you use for listening to CRUD events.

For instance, in Angular you could use the `watch` method and update the collection:

```javascript
$cats.watch('content', function(collection) {

    $scope.cats = collection;

    if (!$scope.$$phase) {
        $scope.$apply();
    }

});
```

Promises
-----

With each create, read, update, and delete, Catwalk invokes a callback which allows you to communicate with your API. For every callback a <a href="http://martinfowler.com/bliki/JavascriptPromise.html">promise</a> is created which **must** be resolved or rejected.

For example, if you used the `createModel` method, then the `create` callback will be invoked &ndash; passing through the promise, and the model that was created. Once you have saved the model via your API, you can resolve the promise. If for some reason the save fails then you can reject the promise &ndash; Catwalk will rollback the creation of the model.

```javascript
$cats.watch('create', function(deferred, model) {
    myApi.save(JSON.stringify(model));
    deferred.resolve();
});
```

Other callbacks are exactly the same and provide the same rollback functionality when rejected: `create`, `update`, `delete`.

However, `read` is the exception because a model does not yet exist. With the `read` callback we are asking your API to return the model because Catwalk does not have it &ndash; with this we merely pass through the ID of the model. You are only given **one** opportunity to return a desired model.

```javascript
$cats.watch('read', function(deferred, property, value) {

    myApi('http://www.example.org/cat/' + property + '/' + value, function(model) {

        deferred.resolve({
            id: id,
            colour: 'Blue'
        });

    });

});
```

Contributions
-----

If you have any valuable contributions to offer Catwalk, they will be happily merged in to master!