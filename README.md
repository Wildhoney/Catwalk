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