(function($catwalk) {

    $catwalk.Model.Cat.on('create', function onCreate(promise, primaryKey) {
        promise.resolve();
    });

    $catwalk.Model.Cat.on('read', function onRead(promise, model) {
        promise.resolve(data);
    });

    $catwalk.Model.Cat.on('update', function onUpdate(promise, model) {
        promise.resolve();
    });

    $catwalk.Model.Cat.on('delete', function onDelete(promise, model) {
        promise.resolve();
    });

    var model = new $catwalk.Model.Cat({
        id      : 1,
        age     : 28,
        name    : 'Adam',
        colours : [1,2,3]
    });

    model.save();

})(window.catwalk);