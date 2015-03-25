/* 
 * Genetic algorithms on canvas, v1.2.7
 *
 * Description: Uses a simple genetic algorithm to evolve a population of random strings
 * into a population of target strings. Inspired by Richard Dawkins' weasel program.
 *
 * Dependencies: none
 *
 * Todo: parameters as functions of input length with auto mutable weights
 * autooptimization at runtime by min amount of time until target
 * a real molecule is both data and processor
 * evolvable evolution framework?
 * randomness seems to be broken somewhere: last char often found with sample string from v0.1
 * overall efficiency NaN in background tabs?
 * that pixel in last graph iteration
 * clearCanvas style setting not implemented
 * better graph plotting functions
 * merge structural changes from webgl demo
 */

(function (globals) {
    'use strict';
    /* Init */
    globals.app = {
        options: {
            populationSize: 100,
            survivalRate: 0.5,
            mutationRate: 0.8,
            stepInterval: 100
        },
        input: {
            target: '',
            alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0120456789 \'.,!?;:()'
        //     alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0120456789\
        // АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя \'.,!?;:()';
        },
        state: {
            population: []
        },
        stats: {
            generations: 0,
            lastDied: 0,
            diedSinceImprovement: 0,
            dead: 0,
            bestFitness: undefined,
            previousBestFitness: undefined,
            lastImprovement: 0,
            initialFitness: undefined,
            efficiency: 0,
            startDate: undefined,
            endDate: undefined
        },
        handles: {
            view: undefined,
            viewCanvas: undefined,
            viewContext: undefined,
            textView: undefined
        },
        mutating: {}
    };
    var app = globals.app;
    if (! (app.options.populationSize && app.options.survivalRate && app.options.mutationRate
        && app.options.stepInterval)) { throw new Error('required options not set'); }

    /* Local functions */

    // Maps array by function
    app.map = function (array, func) {
        return Array.prototype.map.call(array, func);
    };

    // Returns a random index of an array
    app.randomIndex = function (array) {
        return Math.round(Math.random() * (array.length - 1));
    };

    // Returns random argument or random array element
    app.roll = function () {
        if (arguments.length === 1 && arguments[0] instanceof Array) {
            return app.roll.apply(undefined, arguments[0]);
        } else {
            return arguments[app.randomIndex(arguments)];
        }
    };

    // Returns true or false randomly
    app.flipCoin = function () {
        return (Math.random() > 0.5) ? true : false;
    };

    // Returns a string with replaced character at given index
    app.replaceChar = function (string, position, character) {
        return app.map(string, function (value, index) {
            return (index === position) ? character : value;
        }).join('');
    };

    // Returns an array of charcodes for given string
    app.charCodes = function (string) {
        return app.map(string, function (character, index) {
            return character.charCodeAt(0);
        });
    };

    // Returns an element of an array or ''
    app.get = function (array, index) {
        if (array[index] !== undefined) { return array[index]; }
        else { return ''; }
    };

    // Returns last element of an array
    app.last = function (array) {
        return array[array.length - 1];
    };

    // Returns an array with two elements at certain point swapped
    app.swap = function (array, index) {
        if (index === undefined) { throw new Error('function requires 2 arguments'); };
        if (array[index] === undefined) { index = array.length - 1; };
        array = array.slice(0);
        var cachedElement = array[index];
        if (array[index + 1] !== undefined) {
            array[index] = array[index + 1];
            array[index + 1] = cachedElement;
        } else {
            array[index] = array[index - 1];
            array[index - 1] = cachedElement;
        }
        return array;
    };

    // Returns a randomly inxremented or decremented character
    app.randomizeChar = function (character) {
        var increment = app.roll(1, -1);
        return String.fromCharCode(character.charCodeAt(0) + increment);
    };

    // Returns sum of a numeric array mapped from given by function
    app.mapToSum = function (array, func) {
        return app.map(array, func).reduce(function (previous, current) {
            return previous + current;
        }, 0);
    };

    // Returns difference between two dates in minutes
    app.dateDiffMin = function (date1, date2) {
        var msPerMinute = 1000 * 60;
        return Math.floor(Math.abs((date2.getTime() - date1.getTime()) / msPerMinute));
    };

    // Returns content checksum for a string
    app.checksum = function (string) {
        return app.mapToSum(string, function (character, index) {
            return character.charCodeAt(0) + index * 3;
        });
    };

    // Returns pattern signature for a string
    app.signature = function (string) {
        if (string === '') { return 0; };
        return app.checksum(string) * 2
            + string.length * 1
            + string.charCodeAt(0) * 3
            + app.last(string).charCodeAt(0) * 3;
    };

    // Returns specimen signature
    app.specimenSignature = function (specimen) {
        return app.mapToSum(specimen.split(' '), function (word, index) {
            return app.signature(word) + index * 10000;
        });
    };

    // Makes new random specimen of given length
    app.newSpecimen = function (length) {
        var n;
        var string = '';
        for (n = 0; n < length; n += 1) {
            string = string + app.randomChar();
        };
        return string;
    };

    // Makes new random population of given size with given median specimen length from scratch
    app.newPopulation = function (size, medianLength) {
        var n;
        var population = [];
        for (n = 0; n < size; n += 1) {
            // population.push(app.newSpecimen(Math.random() * 2 * medianLength));
            population.push(app.newSpecimen(medianLength));
        };
        return population;
    };

    // Returns given number of fittest specimens
    app.selectFittest = function (population, number, target) {
        var fitnessMap = app.map(population, function (specimen, index) {
            return {
                'specimen': specimen,
                'fitness': app.fitness(specimen, target)
            };
        });
        var fittestObjList = fitnessMap.sort(function (a, b) {
            if (a.fitness < b.fitness) return 1;
            if (a.fitness > b.fitness) return -1;
            if (a.fitness === b.fitness) return 0;
        }).slice(0, number);
        return app.map(fittestObjList, function (element, index) {
            return element.specimen;
        });
    };

    // Scales a population up by cloning existing specimens, possibly with mutations
    app.scaleUpPopulation = function (population, size, mutationRate) {
        var n;
        var numberLacking = size - population.length;
        if (numberLacking <= 0) return population;
        var scaledPopulation = population;
        for (n = 0; n < numberLacking; n += 1) {
            scaledPopulation.push(app.clone(app.roll(population), mutationRate));
        };
        return scaledPopulation;
    };

    // Makes a new generation from given population
    app.newGeneration = function (population, survivalRate, mutationRate, target) {
        var populationSize = population.length;
        var survivorPopulation = app.selectFittest(population, Math.round(survivalRate * populationSize), target);
        return app.scaleUpPopulation(survivorPopulation, populationSize, mutationRate);
    };

    // Makes a clone of a given specimen with given chance of random mutation
    app.clone = function (specimen, mutationRate) {
        return (Math.random() < mutationRate) ? app.mutate(specimen) : specimen;
    };

    // Returns mutated specimen with random deletion
    app.mutateDelete = function (specimen) {
        return app.replaceChar(specimen, app.randomIndex(specimen), '');
    };

    // Returns mutated specimen with random duplication
    app.mutateDuplicate = function (specimen) {
        var index = app.randomIndex(specimen);
        var character = specimen[index];
        return app.replaceChar(specimen, index, character + character);
    };

    // Returns mutated specimen with a randomly incremented or decremented character
    app.mutateRandomize = function (specimen) {
        var index = app.randomIndex(specimen);
        return app.replaceChar(specimen, index, app.randomizeChar(specimen[index]));
    };

    // Returns mutated specimen with multiple randomly incremented/decremented characters
    app.mutateRandomizeMulti = function (specimen) {
        return app.map(specimen, function (character, index) {
            return (Math.random() > 0.1) ? app.randomizeChar(character) : character;
        }).join('');
    };

    // Returns mutated specimen with a randomly replaced character
    app.mutateReplace = function (specimen) {
        return app.replaceChar(specimen, app.randomIndex(specimen), app.randomChar());
    };

    // Returns mutated specimen with randomly swapped characters
    app.mutateSwapChars = function (specimen) {
        var chars = specimen.split('');
        return app.swap(chars, app.randomIndex(chars)).join('');
    };

    // Returns mutated specimen with randomly swapped words
    app.mutateSwapWords = function (specimen) {
        var words = specimen.split(' ');
        return app.swap(words, app.randomIndex(words)).join(' ');
    };

    // Returns a randomly mutated specimen
    app.mutate = function (specimen) {
        var methods = [app.mutateReplace];
        return app.roll(methods)(specimen);
    };

    // Returns a random character
    app.randomChar = function () {
        var alphabet = app.input.alphabet;
        return app.roll(alphabet.split(''));
    };

    // Calculates fitness of a given specimen with respect to target
    app.continuousFitness = function (specimen, target) {
        var lengthDifference = Math.abs(specimen.length - target.length);
        var specimenCharCodes = app.charCodes(specimen);
        var targetCharCodes = app.charCodes(target);
        var longArray = (specimenCharCodes.length > targetCharCodes.length) ? specimenCharCodes : targetCharCodes;
        var shortArray = (specimenCharCodes.length <= targetCharCodes.length) ? specimenCharCodes : targetCharCodes;
        var contentDifference = app.mapToSum(longArray, function (value, index) {
            var shortArrayValue;
            if (shortArray[index] === undefined) { shortArrayValue = ' '.charCodeAt(0); }
            else { shortArrayValue = shortArray[index]; };
            return Math.abs(value - shortArrayValue);
            return Math.abs(value - app.get(shortArray, index));
        });
        return 1 - lengthDifference - contentDifference;
    };

    // Calculates fitness of a given specimen with respect to target in a discrete fashion
    app.discreteFitness = function (specimen, target) {
        var lengthDifference = Math.abs(specimen.length - target.length);
        var specimenCharCodes = app.charCodes(specimen);
        var targetCharCodes = app.charCodes(target);
        var longArray = (specimenCharCodes.length > targetCharCodes.length) ? specimenCharCodes : targetCharCodes;
        var shortArray = (specimenCharCodes.length <= targetCharCodes.length) ? specimenCharCodes : targetCharCodes;
        var contentDifference = app.mapToSum(longArray, function (value, index) {
            if (value === app.get(shortArray, index)) { return 0; }
            else { return 1; }
        });
        return 1 - lengthDifference - contentDifference;
    };

    // Calculates fitness of a given specimen with respect to target on a by word basis
    app.complicatedFitness = function (specimen, target) {
        var lengthDifference = Math.abs(specimen.length - target.length);
        var wordCountDifference = Math.abs(specimen.split(' ').length - target.split(' ').length);
        var contentDifference = Math.abs(app.specimenSignature(specimen) - app.specimenSignature(target));
        return 1 - lengthDifference - wordCountDifference * 4 - contentDifference * 2;
    };

    // Calculates fitness of a given specimen with respect to target
    app.fitness = function (specimen, target) {
        return app.discreteFitness(specimen, target);
    };

    // Calculates fitness of a given word with respect to target word
    app.wordFitness = function (word, targetWord) {
        var lengthDifference = Math.abs(word.length - targetWord.length);
        var keyPointDifference = (function () {
            if (word[0] === targetWord[0] && app.last(word) === app.last(targetWord)) {
                return 0;
            } else if (word[0] === targetWord[0] || app.last(word) === app.last(targetWord)) {
                return 2;
            } else {
                return 7;
            }
        }());
        var contentDifference = Math.abs(app.checksum(word) - app.checksum(targetWord));
        return 1 - lengthDifference - keyPointDifference * 40 - contentDifference * 2;
    };

    // Returns best fitness in a population
    app.bestFitness = function (population, target) {
        var fitnessMap = app.map(population, function (specimen, index) {
            return app.fitness(specimen, target);
        });
        return Math.max.apply(undefined, fitnessMap);
    };

    // Returns efficiency for given fitness acquired per death toll
    app.efficiency = function (fitnessDiff, deathToll) {
        return Math.round(Math.abs(fitnessDiff / deathToll) * 100000);
    };

    // Plots a dot on a canvas
    app.mutating.plotDot = function (context, x, y, color, factor) {
        color = color || 'white';
        factor = factor || 1;
        context.fillStyle = color;
        context.fillRect(x * app.state.drawingXFactor, y * app.state.drawingYFactor * factor, 1, 1);
    };

    // Plots a histogram slice on a canvas
    app.mutating.plotHistogram = function (context, x, y, color, backgroundColor, alignment, factor) {
        color = color || 'white';
        backgroundColor = backgroundColor || 'grey';
        alignment = alignment || 'bottom';
        factor = factor || 1;
        context.fillStyle = backgroundColor;
        if (alignment === 'bottom') {
            context.fillRect(x * app.state.drawingXFactor, y * app.state.drawingYFactor * factor, 1, context.canvas.height);
        } else if (alignment === 'top') {
            context.fillRect(x * app.state.drawingXFactor, y * app.state.drawingYFactor * factor, 1, -context.canvas.height * 10);
        }
        app.mutating.plotDot(context, x, y, color, factor);
    };

    // Resizes canvas to its real client size
    app.mutating.refitCanvas = function (canvas) {
        var cacheCanvas = document.createElement('canvas');
        cacheCanvas.width = canvas.width;
        cacheCanvas.height = canvas.height;
        var cacheContext = cacheCanvas.getContext('2d');
        cacheContext.drawImage(canvas, 0, 0); // cache
        canvas.width = canvas.clientWidth; // refit
        canvas.height = canvas.clientHeight;
        canvas.getContext('2d').drawImage(cacheCanvas, 0, 0); // apply cache
    };

    // Clears canvas
    app.mutating.clearCanvas = function(canvas, style) {
        canvas.width = canvas.width;
        // context.fillStyle = style || 'white';
        // context.fillRect(0, 0, canvas.width, canvas.height);
    };

    // Displays extra arguments as text
    app.mutating.displayText = function (textView) {
        var string = Array.prototype.join.call(Array.prototype.slice.call(arguments, 1), '');
        textView.innerHTML = string;
    };

    // Inits output view before algorithm run
    app.mutating.initView = function (view) {
        app.handles.viewCanvas = view.querySelector('canvas');
        var canvas = app.handles.viewCanvas
        app.mutating.clearCanvas(canvas);
        app.mutating.refitCanvas(canvas);
        app.handles.viewContext = canvas.getContext('2d');
        app.state.drawingXFactor = 1 / Math.round(Math.log(Math.abs(app.stats.bestFitness))) * canvas.width / 500;
        app.state.drawingYFactor = app.handles.viewCanvas.height / Math.abs(app.stats.bestFitness);
        app.handles.textView = view.querySelector('.textView');
        var textView = app.handles.textView;
        app.mutating.displayText(textView, 'Best fitness ', app.stats.bestFitness,' of specimen:\n',
                app.selectFittest(app.state.population, 1, app.input.target)
        );
    };

    // Inits app state before algorithm run with given target
    app.mutating.initAlgorithm = function (target) {
        app.state.population = app.newPopulation(app.options.populationSize, app.input.target.length);
        app.stats.generations = 1;
        app.stats.lastDied = 0;
        app.stats.diedSinceImprovement = 0;
        app.stats.dead = 0;
        app.stats.efficiency = 0;
        app.stats.startDate = undefined;
        app.stats.endDate = undefined;
        app.stats.bestFitness = app.bestFitness(app.state.population, app.input.target);
        app.stats.previousBestFitness = app.stats.bestFitness;
        app.stats.initialFitness = app.stats.bestFitness;
        app.stats.lastImprovement = 0;
    };

    // Application main loop
    app.mutating.mainLoop = function () {
        app.state.population = app.newGeneration(
                app.state.population,
                app.options.survivalRate,
                app.options.mutationRate,
                app.input.target
        );
        app.stats.lastDied = Math.round(app.options.populationSize * (1 - app.options.survivalRate));
        app.stats.dead += app.stats.lastDied;
        app.stats.generations += 1;
        app.stats.previousBestFitness = app.stats.bestFitness;
        app.stats.bestFitness = app.bestFitness(app.state.population, app.input.target);
        app.stats.lastImprovement = (app.stats.bestFitness !== app.stats.previousBestFitness) ?
                app.stats.bestFitness - app.stats.previousBestFitness :
                app.stats.lastImprovement;
        app.stats.diedSinceImprovement = (app.stats.bestFitness !== app.stats.previousBestFitness) ?
                app.stats.lastDied :
                app.stats.diedSinceImprovement + app.stats.lastDied;
        app.stats.efficiency = app.efficiency(app.stats.lastImprovement, app.stats.diedSinceImprovement);
        app.mutating.displayText(app.handles.textView, 'Best fitness ', app.stats.bestFitness, ' of specimen:\n\n',
                app.selectFittest(app.state.population, 1, app.input.target),
                '\n\n', app.stats.dead, ' dead with current efficiency ', app.stats.efficiency
        );
        app.mutating.plotHistogram(
                app.handles.viewContext,
                app.stats.generations,
                app.stats.dead / 100,
                'hsla(0, 100%, 29%, 1)',
                'hsla(0, 100%, 20%, 0.25)',
                'top',
                1 / app.options.populationSize
        );
        app.mutating.plotHistogram(
                app.handles.viewContext,
                app.stats.generations,
                Math.abs(app.stats.bestFitness),
                'hsla(0, 0%, 47%, 1)',
                'hsla(0, 0%, 39%, 0.25)'
        );
        if (app.stats.bestFitness === 1) { app.mutating.endAlgorithmRun(); }
    };

    // Starts algorithm run
    app.mutating.startAlgorithmRun = function () {
        app.stats.startDate = new Date();
        app.handles.mainInterval = setInterval(app.mutating.mainLoop, app.options.stepInterval);
    };

    // Ends algorithm run
    app.mutating.endAlgorithmRun = function () {
        clearInterval(app.handles.mainInterval);
        app.stats.endDate = new Date();
        app.mutating.displayText(app.handles.textView, 'Best fitness ', app.stats.bestFitness,
            ' of specimen:\n\n', app.selectFittest(app.state.population, 1, app.input.target),
            '\n\n', app.stats.dead, ' dead with overall efficiency ',
            app.efficiency(app.stats.bestFitness - app.stats.initialFitness, app.stats.dead),
            '\nafter ', app.stats.generations, ' generations and ',
            app.dateDiffMin(app.stats.endDate, app.stats.startDate), ' minutes runtime.'
        );
    };

    // Restarts algorithm with given target
    app.mutating.restartAlgorithm = function (target, view) {
        app.mutating.endAlgorithmRun();
        app.mutating.initAlgorithm(target);
        app.mutating.initView(view);
        app.mutating.startAlgorithmRun();
    };


    /* On page load execute function list */
    document.addEventListener('DOMContentLoaded', function (event) { 
        [
            // init algorithm
            function () {
                app.input.target = document.querySelector('[data-input="target"]').value;
                app.mutating.initAlgorithm(app.input.target);
            },

            // init view
            function () {
                app.handles.view = document.querySelector('[data-view="main"]');
                app.mutating.initView(app.handles.view);
            },

            // run algorithm
            function () {
                app.mutating.startAlgorithmRun();
            },

            // restart on execute button press or enter
            function () {
                var restartHandler = function () {
                    app.input.target = document.querySelector('[data-input="target"]').value;
                    app.mutating.restartAlgorithm(app.input.target, app.handles.view);
                };
                var restartButton = document.querySelector('[data-action="restartAlgorithm"]');
                restartButton.addEventListener('click', restartHandler);
                var targetInput = document.querySelector('[data-input="target"]');
                targetInput.addEventListener('keydown', function (event) {
                    if (event.keyCode === 13) { restartHandler(); };
                });
            }

        ].forEach(function (func, index) {
            try { func(); }
            catch (err) { console.log(err); };
        });
    });

}(this));