(function($catwalk) {

    describe('Catwalk', function() {

        describe('Collections', function() {

            it('Can create collections', function() {

                $catwalk.collection('catsOne', {
                    _primaryKey: 'name',
                    name: $catwalk.attribute.string
                });

                expect(typeof $catwalk.collection('catsOne')).toEqual('object');
                expect($catwalk.collection('catsOne')._name).toEqual('catsOne');
                $catwalk.deleteCollection('catsOne');

            });

        });

        describe('Models', function() {

            var $cats;

            beforeEach(function() {

                $cats = $catwalk.collection('catsTwo', {
                    _primaryKey: 'id',
                    id: $catwalk.attribute.integer,
                    name: $catwalk.attribute.string
                });

            });

            afterEach(function() {
                $catwalk.deleteCollection('catsTwo');
            });

            it('Can create models', function() {
                $cats.createModel({ id: 1, name: 'Kipper' });
                $cats.createModel({ id: 2, name: 'Miss Kittens' });
                $cats.createModel({ id: 3, name: 'Busters' });
                expect($cats.all().length).toEqual(3);
            });

            it('Can update models', function() {
                var kipper = $cats.createModel({ id: 1, name: 'Kipper' });
                expect($cats.all()[0].name).toEqual('Kipper');
                $cats.updateModel(kipper, { name: 'Darling Kipper' });
                expect($cats.all()[0].name).toEqual('Darling Kipper');
            });

            it('Can delete models', function() {
                $cats.createModel({ id: 1, name: 'Kipper' });
                var missKittens = $cats.createModel({ id: 2, name: 'Miss Kittens' });
                $cats.createModel({ id: 3, name: 'Busters' });
                $cats.deleteModel(missKittens);
                expect($cats.all().length).toEqual(2);
            });

        });

        describe('Relationships', function() {

            var $cats;

            beforeEach(function() {

                $cats = $catwalk.collection('catsThree', {
                    _primaryKey: 'id',
                    _relationships: {
                        friends: $catwalk.relationship.hasMany({
                            collection: 'catsThree',
                            foreignKey: 'id'
                        }),
                        sibling: $catwalk.relationship.hasOne({
                            collection: 'catsThree',
                            foreignKey: 'id'
                        })
                    },
                    id: $catwalk.attribute.integer,
                    name: $catwalk.attribute.string
                });

            });

            afterEach(function() {
                $catwalk.deleteCollection('catsThree');
            });

            it('Can use hasOne relationship', function() {
                var kipper      = $cats.addModel({ id: 1, name: 'Kipper', sibling: 3 });
                var missKittens = $cats.addModel({ id: 2, name: 'Miss Kittens', sibling: 1 });
                var busters     = $cats.addModel({ id: 3, name: 'Busters', sibling: 2 });
                expect(kipper.sibling.name).toEqual('Busters');
                expect(missKittens.sibling.name).toEqual('Kipper');
                expect(busters.sibling.name).toEqual('Miss Kittens');
            });

            it('Can use hasMany relationship', function() {
                $cats.addModel({ id: 1, name: 'Kipper' });
                $cats.addModel({ id: 2, name: 'Miss Kittens' });
                var busters = $cats.addModel({ id: 3, name: 'Blah', friends: [1, 2] });
                expect(busters.friends.length).toEqual(2);
                expect(busters.friends[0].name).toEqual('Miss Kittens');
                expect(busters.friends[1].name).toEqual('Kipper');
            });

        });

        describe('Defaults', function() {

            var $cats;

            beforeEach(function() {

                $cats = $catwalk.collection('catsFour', {
                    _primaryKey: 'id',
                    id: $catwalk.attribute.integer,
                    name: 'Kipper',
                    age: 15
                });

            });

            afterEach(function() {
                $catwalk.deleteCollection('catsFour');
            });

            it('Can define a default string value', function() {
                var kipper = $cats.addModel({ id: 1 });
                expect(kipper.name).toEqual('Kipper');
            });

            it('Can use its own value when necessary', function() {
                var busters = $cats.addModel({ id: 2, name: 'Busters' });
                expect(busters.name).toEqual('Busters');
            });

            it('Can typecast from a default value', function() {
                var missKittens = $cats.addModel({ name: 'Miss Kittens', age: '5' });
                expect(typeof missKittens.age).toEqual('number');
                expect(missKittens.age).toEqual(5);
            });

        });

        describe('Computed Properties', function() {

            var $cats;

            beforeEach(function() {

                $cats = $catwalk.collection('catsFive', {
                    _primaryKey: 'name',
                    name: $catwalk.attribute.string,
                    age: $catwalk.attribute.number,
                    isAdult: $catwalk.computedProperty(function() {
                        return (this.age > 6);
                    })
                });

            });

            afterEach(function() {
                $catwalk.deleteCollection('catsFive');
            });

            it('Can compute a computed property', function() {
                var kipper = $cats.addModel({ id: 1, name: 'Kipper', age: 15 });
                expect(kipper.isAdult).toEqual(true);
                var busters = $cats.addModel({ id: 2, name: 'Busters', age: 6 });
                expect(busters.isAdult).toEqual(false);
                var missKittens = $cats.addModel({ id: 3, name: 'Miss Kittens', age: 3 });
                expect(missKittens.isAdult).toEqual(false);
            });

        });

        describe('Attribute Typecasting', function() {

            var $cats;

            beforeEach(function() {

                $cats = $catwalk.collection('catsSix', {
                    _primaryKey: 'number',
                    number: $catwalk.attribute.number,
                    floatTwo: $catwalk.attribute.float(2),
                    boolean: $catwalk.attribute.boolean,
                    date: $catwalk.attribute.date('YYYY'),
                    custom: $catwalk.attribute.custom(function(value) {
                        return value.toUpperCase();
                    })
                });

            });

            afterEach(function() {
                $catwalk.deleteCollection('catsSix');
            });

            it('Can typecast string to a number', function() {
                var model = $cats.addModel({
                    number: "2"
                });
                expect(model.number).toEqual(2);
            });

            it('Can typecast number to a boolean', function() {
                var model = $cats.addModel({
                    boolean: 0
                });
                expect(model.boolean).toEqual(false);
                model = $cats.addModel({
                    boolean: 1
                });
                expect(model.boolean).toEqual(true);
            });

            it('Can typecast float to two decimal places', function() {
                var model = $cats.addModel({
                    floatTwo: 1.9863248634
                });
                expect(model.floatTwo).toEqual('1.99');
            });

            it('Can typecast date to another date format', function() {
                var model = $cats.addModel({
                    date: '10 oct 1985'
                });
                expect(model.date).toEqual('1985');
            });

            it('Can typecast custom to uppercase', function() {
                var model = $cats.addModel({
                    custom: 'Kipper'
                });
                expect(model.custom).toEqual('KIPPER');
            });

        });

    });

})(window.catwalk);