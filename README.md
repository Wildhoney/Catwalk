Catwalk.js
======

Why Catwalk? Because it's jam-packed full of models! Catwalk has engendered from the observations on the plight of <a href="https://github.com/emberjs/data" target="_blank">Ember Data</a>, and instead doesn't even *try* to predict everything &ndash; instead Catwalk.js is more focused on satisfying the <a href="http://en.wikipedia.org/wiki/KISS_principle" target="_blank">KISS principle</a>.

**Friends:** Uses <a href="https://github.com/square/crossfilter" target="_blank">Crossfilter</a>, <a href="http://underscorejs.org/" target="_blank">Underscore</a>, and <a href="https://github.com/kriskowal/q" target="_blank">Q</a> extensively.

<img src="http://fc06.deviantart.net/fs37/i/2008/265/2/8/Cat_silhouette_by_valsgalore.png" />

Creating a Collection
-----

Collections are mostly made up of the properties &ndash; each property is a value, or a function which will allow Catwalk to determine how to typecast each property.

```javascript
/**
 * @property name
 * @type {String}
 */
name: $catwalk.attribute.string
```

In the above case, the `name` property will be typecasted to a `string`.

Aside from the properties for a collection, a collection can define its primary key via the protected `_primaryKey` property, and can also define relationships using the `_relationships` object.

```javascript
/**
 * @property _relationships
 * @type {Object}
 * @protected
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

}
```

Each `_relationships` descriptor is comprised of a property which maps to another collection &ndash; currently `hasOne` and `hasMany` are supported.

The properties inside of the relationship descriptor are both the `collection` it maps to, and on which property we'll create the relationship with the `foreignKey` property.

In the example above, each model that adds itself to the collection would define a `colours` property with an array of colour IDs. When you access `model.colours` on the model, the actual colours will be brought back from the `Colours` collection.

Adding Models
-----

Once you've created your collection, models can easily be adding to it via with the `addModel`/`addModels` methods.

```javascript
$colours.addModel({ id: 1, colour: 'Black' });
$colours.addModel({ id: 2, colour: 'White' });
$colours.addModel({ id: 3, colour: 'Ginger' });
$colours.addModel({ id: 4, colour: 'Grey' });
```

Upon adding the models to your collection, the `create` method will be invoked, passing through the models that were created.

```javascript
$cats.when('create', function(models) {
    $scope.cats = $cats.all();
});
```

Deleting Models
-----

Deleting models from the collection is just as easy as adding them. Catwalk uses an internal ID on each model to remove them, therefore you just need to pass through the Catwalk model you wish to delete.

```javascript
var blackModel = $colours.addModel({ id: 1, colour: 'Black' });
$colours.removeModel(blackModel);
```

As with the invoking of the `create` method when adding models, the `delete` method is invoked when deleting models &ndash; passing through the models that were deleted.

```javascript
$cats.when('delete', function(models) {
    $scope.cats = $cats.all();
});
```

Updating Models
-----

Updating of models is **very** simple &ndash; but behind the scenes, Catwalk deletes the model and then re-adds it to the Crossfilter. Because of this, any models you have from the `addModel`/`addModels` method(s) will become invalid &ndash; you should instead replace them with the model returned from `updateModel`.

```javascript
var missKittens = $cats.addModel({ id: 3, name: 'Miss Kittens', age: 4, colours: [1, 2, 3, 4] });

$cats.updateModel(missKittens, {
    name: 'Lucifer'
});
```

In the above example we have just updated the name of `missKittens` by changing her name to **Lucifer** &ndash; very aptly named. We can also update relationships in exactly the same way.

```javascript
$cats.updateModel(missKittens, {
    colours: [1, 2]
});
```

It's perhaps worth noting that you **only** need to update the properties that you want changing, otherwise they are copied from the previous model.