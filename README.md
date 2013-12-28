Catwalk.js
======

<img src="https://travis-ci.org/Wildhoney/Catwalk.js.png?branch=master" />
&nbsp;
<img src="https://badge.fury.io/js/catwalk.js.png" />

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
    age: $catwalk.attribute.integer

});
```

In the above example we have defined a `$cats` collection, which has three properties: `id`, `name`, and `age`. Each property can be assigned to a value, or a Catwalk function which will typecast the property for you.

All simple properties can assume a default value for when a value hasn't specifically been set by the model. Simply define the property in the collection blueprint as the default value, and Catwalk will do the rest. As you don't specify the typecast method any more, Catwalk automatically typecasts based on the `typeof` the default value.

```javascript
var $cats = $catwalk.collection('cats', {

    /**
     * @property name
     * @type {String}
     * @default "Kipper"
     */
    name: 'Kipper'

});
```

Catwalk has the following *typecastable* functions:

 * `catwalk.attribute.string`
 * `catwalk.attribute.boolean`
 * `catwalk.attribute.integer` (alias: `catwalk.attribute.number`)
 * `catwalk.attribute.date(format)` &ndash; requires <a href="http://momentjs.com/" target="_blank">Moment.js</a>
 * `catwalk.attribute.float(decimalPlaces)`
 * `catwalk.attribute.custom(callback)`

With the `$catwalk.attribute.custom` typecast, the value of each model is passed into the <a href="http://en.wikipedia.org/wiki/Currying" target="_blank">curry</a> method, and it's entirely up to you how to format the value &ndash; as long as you remember to `return` it!

```javascript
/**
 * @property name
 * @type {String}
 */
name: $catwalk.attribute.custom(function(value) {
    return String(value).toUpperCase();
})
```

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

<h3>Computed Properties</h3>

Catwalk has support for computed properties which allow you to add your business logic to the models. To define a computed property simply assign a property to `catwalk.computedProperty` which will be invoked with the model scope as `this`.

```javascript
/**
 * @property isAdult
 * @type {Boolean}
 */
isAdult: $catwalk.computedProperty(function() {
    return (this.age > 6);
})
```

<h3>Relationships</h3>

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

Catwalk also has an `addModel` method which functions **exactly** like the `createModel` method except the `create` callback is not invoked.

In order for Catwalk to begin mapping the relationship, our model defines the `colours` property with an array of IDs.

During the `create` process it is possible to add properties to the model via the promise. Simply pass through any additional properties that should be set on the model after its creation via the `resolve` and Catwalk will do the rest.

```javascript
$catwalk.event.on('create', function(collectionName, deferred, model) {
    deferred.resolve({
        name: 'Miss Kittens'
    });
});
```

In the example above, every single created `cat` will inherit the name **Miss Kittens** &ndash; uh-oh! Only simple values can be updated this way, including the primary key &ndash; whereas relationships cannot.

<h3>Updating Models</h3>

You can modify any property of a model by using the `updateModel` method. Each and every property can be updated, including the relationships.

```javascript
$cats.updateModel(missKittens, {
    name: 'Lucifer',
    colours: [1, 2]
});
```

In the above example we have changed Miss Kittens to Lucifer &ndash; a **very** apt name! We have also updated the relationship to only two colours instead of three.

<h4>Replacing Models</h4>

Sometimes you may wish to `resolve` the promise, but resolve it with a different model to what we have &ndash; especially in cases where you have added a duplicate model.

```javascript
$catwalk.event.on('create', function(collection, deferred, model) {

    var colours = _.where(this.collection('colours').all(), { name: model.name });

    if (colours.length > 1) {
        deferred.resolve(colours[colours.length - 1]);
        return;
    }

    deferred.resolve();

});
```

With the code above we're checking the `colours` collection for an existing model by the `name` property. If we find an existing model with the `length` property then we'll use that model instead of the newly created one. We still `resolve` the promise, but pass along the model we wish to replace it with.

<h3>Deleting Models</h3>

We can delete models using the `deleteModel` method which accepts one parameter of the model you wish to delete.

```javascript
$cats.deleteModel(missKittens);
```

Updates
-----

Whenever a collection has been updated, the `content` event is invoked. You can watch the `content` event with the `on` method &ndash; which is the same method you use for listening to CRUD events.

For instance, in Angular you could use the `on` method and update the collection:

```javascript
$catwalk.event.on('content', function(collection) {

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
$catwalk.event.on('create', function(collectionName, deferred, model) {
    myApi.save(JSON.stringify(model));
    deferred.resolve();
});
```

Other callbacks are exactly the same and provide the same rollback functionality when rejected: `create`, `update`, `delete`.

However, `read` is the exception because a model does not yet exist. With the `read` callback we are asking your API to return the model because Catwalk does not have it &ndash; with this we merely pass through the ID of the model. You are only given **one** opportunity to return a desired model.

```javascript
$catwalk.event.on('read', function(collectionName, deferred, property, value) {

    myApi('http://www.example.org/cat/' + property + '/' + value, function(model) {

        deferred.resolve({
            id: id,
            colour: 'Blue'
        });

    });

});
```

<h3>Transactions</h3>

As Catwalk presents a promise for you to `resolve`/`reject`, it's **entirely** up to you at which point you perform that action. Therefore you could quite easily defer the promise until you have a handful and then process them in one fell swoop.

Relationships
-----

All relationships are defined with the protected `_relationships` property, and can be either a `hasOne` or `hasMany` relationship. Every single property can be involved in a relationship &ndash; not just the primary key.

```javascript
$countries.createModel({ id: 1, name: 'United Kingdom', code: 'UK' });
$people.createModel({ id: 1, name: 'Adam', country: 'UK' });
```

In the above example we have created a `hasOne` relationship between people and countries on the `country` property.

```javascript
/**
 * @property _relationships
 * @type {Object}
 * @protected
 */
_relationships: {

    /**
     * @property country
     * @type {Object}
     */
    country: $catwalk.relationship.hasOne({
        collection: 'countries',
        foreignKey: 'code'
    })

}
```

We can therefore access the `country` property on each person model to bring back their related country. Notice that the relationship isn't performed on the primary key (`id`) but rather on the `code` property.

In each relationship descriptor you can also define the format of the values. For example, if you're expecting an array of IDs and your API passes through an array of strings, you can typecast these &ndash; which is **highly** recommended to avoid annoying *bugs*.

```javascript
/**
 * @property _relationships
 * @type {Object}
 * @protected
 */
_relationships: {

    /**
     * @property country
     * @type {Object}
     */
    country: $catwalk.relationship.hasOne({
        collection: 'countries',
        foreignKey: 'id',
        typecast:   $catwalk.attributes.integer
    })

}
```