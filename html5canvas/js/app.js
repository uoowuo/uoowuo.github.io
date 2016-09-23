/* 
 * Canvas demo, v0.1
 * Dependencies: jQuery
 * Issues:
* script loading breaks
* noise gen still slow
* probably memhogger
* need native anim
* TODOs
* unify context-canvas func calls
* remove css canvas scaling
* needs webgl if available
* needs generated sound
* needs cooler text effects
* test bitch
 */

(function($){

    /* Init */
    window.app = window.app || {}
    app.frames = 60;
    app.density = 0.7;
    app.framerate = 15;
    // app.quality = 0.3;
    if (app.quality) {
        app.frames = app.frames * app.quality;
        app.framerate = app.framerate * app.quality;
    }

    /* Local functions */

    // Resizes canvas to its real client size
    app.refitCanvas = function(canvas) {
        var cacheCanvas = document.createElement('canvas');
        cacheCanvas.width = canvas.width;
        cacheCanvas.height = canvas.height;
        var cacheContext = cacheCanvas.getContext('2d');
        cacheContext.drawImage(canvas, 0, 0); // cache
        canvas.width = canvas.clientWidth; // refit
        canvas.height = canvas.clientHeight;
        canvas.getContext('2d').drawImage(cacheCanvas, 0, 0); // apply cache
    }

    // Implements firing of jQuery resize event on given element resize
    // FIXME: extraneous initial resize event
    app.implementResizeEvent = function(element) {
        // init
        store = app.implementResizeEvent;
        store.interval = store.interval || { timer:250, handle:null };
        store.elements = store.elements || { list:[], sizes:[] };
        element = (element instanceof jQuery) ? element.get(0) : element;
        // functions
        var pollSizes = function() {
            store.elements.list.forEach(function(e,i) {
                store.elements.sizes[i] = store.elements.sizes[i] || {};
                if (e.clientWidth === store.elements.sizes[i].w &&
                    e.clientHeight === store.elements.sizes[i].h) {
                    return true;
                } else {
                    store.elements.sizes[i] = {
                        w: e.clientWidth,
                        h: e.clientHeight
                    }
                    $(e).trigger('resize');
                    return false;
                }

            });
        }
        // start
        if (store.elements.list.indexOf(element) === -1) {
            store.elements.list.push(element);
        }
        if (!store.interval.handle) {
            store.interval.handle = setInterval(pollSizes, store.interval.timer);
        }
    }

    // Adds scary text to context
    // TODO: unify functions with context and canvas args, make use both
    app.addScaryText = function(text, context, tremor) {
        var fontSizePx = (context.canvas.width < 960) ?
            context.canvas.width / 7 :
            context.canvas.width / 11.4;
        context.font = 'bold ' + fontSizePx + 'px' + ' sans';
        context.lineWidth = Math.max(0.058 * fontSizePx, 2);

        if (context.canvas.width < 960 && text.length > 8) { // adaptive multiline
            var textLines = text.split(' ');
            var randomX = Math.random();
            var randomY = Math.random();
            var lineHeight = 1.2;
            textLines.forEach(function(e,i) {
                context.strokeText(
                    e,
                    context.canvas.width/2 - 0.4*fontSizePx * e.length + randomX*tremor - tremor/2,
                    context.canvas.height/2 + 0.3*fontSizePx + randomY*tremor - tremor/2
                        + (i+0.5 - textLines.length/2) * lineHeight*fontSizePx
                );
            });
        } else { // normal
            context.strokeText(
                text,
                context.canvas.width/2 - 0.4*fontSizePx * text.length + Math.random()*tremor - tremor/2,
                context.canvas.height/2 + 0.3*fontSizePx + Math.random()*tremor - tremor/2
            );
        }
    }

    // Fills given rectangle with monochromatic noise
    app.fillWithNoise = function(context, density, x, y, width, height) {
        // init
        var store = app.fillWithNoise;
        store.cache = store.cache || {};
        store.counter = store.counter || 0;
        // start
        var imageData = context.createImageData(width, height);
        if (store.cache[imageData.data.length]) { // use transformed cached noise if available
            var cachedImageData = store.cache[imageData.data.length];
            var cutOffset = function() { // need to be % 4
                var integer = Math.round(Math.random() * cachedImageData.data.length);
                return (integer % 4) ? integer - integer % 4: integer;
            }();
            var tail = cachedImageData.data.subarray(cutOffset);
            var head = cachedImageData.data.subarray(0, cutOffset);
            imageData.data.set(head, tail.length); // copy cached head and tail, reversed
            imageData.data.set(tail, 0);
            // var cutOffset = cachedImageData.data.length - 4 * Math.round(Math.random() * cachedImageData.data.length / 4);
            // var tail = cachedImageData.data.subarray(cutOffset);
            // var head = cachedImageData.data.subarray(0, cutOffset);
            // imageData.data.set(head, tail.length); // copy cached head and tail, reversed
            // imageData.data.set(tail, 0);
        } else {
            for (var i = -1; i < imageData.data.length; i = i + 4) {
                imageData.data[i] = (Math.random() < density) ? 255 : 0;
            }
            store.cache[imageData.data.length] = imageData;
        }
        context.putImageData(imageData, x, y);
    }

    // Prepares and returns a canvas with random noise
    app.prepareScreen = function(width, height, density) {
        // init
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var context = canvas.getContext('2d');
        // start
        app.fillWithNoise(context, app.density, 0, 0, app.canvas.width, app.canvas.height);
        var text = (app.screens.length < app.frames/2) ? 'ОБЕРНNСЬ' : 'HTML5 CѦNVѦS';

        app.addScaryText(text, context, 20);
        
        return canvas;
    }

    // Clears canvas
    app.clearCanvas = function(canvas, style) {
        var context = canvas.getContext('2d');
        context.fillStyle = style;
        context.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Starts animation
    app.startAnimation = function(canvas) {
        // init
        app.screens = app.screens || [];
        var store = app.startAnimation;
        store.interval = store.interval || { handle:null, timer:1000/app.framerate };
        store.inProgress = true; // lock
        if (!store.inProgress) { return false; }
        // prepare scary pictures
        for (var s = 0; s < app.frames; s++) {
            app.screens.push(
                app.prepareScreen(canvas.width, canvas.height, app.density)
            );
        }
        // animate scary pictures
        app.currentScreen = 0;
        app.canvas.style.visibility = 'visible';
        store.interval.handle = setInterval(function() {
            app.clearCanvas(canvas, 'white');
            app.context.drawImage(app.screens[app.currentScreen], 0, 0);
            if (app.screens[app.currentScreen + 1]) {
                app.currentScreen++;
            } else {
                app.currentScreen = 0;
            }
        }, store.interval.timer);
        store.inProgress = false; // unlock
    }

    // Stops animation
    app.stopAnimation = function(canvas) {
        clearInterval(app.startAnimation.interval.handle);
        app.startAnimation.interval = null;
        app.screens = [];
        app.currentScreen = 0;
        app.canvas.style.visibility = 'hidden';
    }

    // Restarts animation
    app.restartAnimation = function(canvas) {
        var store = app.restartAnimation;
        store.inProgress = true; // lock
        if (!store.inProgress) { return false; }
        app.stopAnimation(canvas);
        app.startAnimation(canvas);
        store.inProgress = false; // unlock
    }

    // Removes simulated jQuery resize event for an element
    app.stopResizeEvent = function(element) {
        element = (element instanceof jQuery) ? element.get(0) : element;
        // TODO
    }

    /* On page load execute function list */
    $(document).ready(function() {
        $([
            // init canvas
            function() {
                app.canvas = $('canvas.mainSurface').get(0);
                app.context = app.canvas.getContext('2d');
                app.implementResizeEvent(app.canvas);
                app.refitCanvas(app.canvas);
                app.startAnimation(app.canvas);

                // restart on resize
                $(app.canvas).on('resize', function(event) {
                    event.target.style.visibility = 'hidden';
                    app.refitCanvas(event.target);
                    app.restartAnimation(event.target);
                });
            }

        ]).each(function(i,e) {
            try { e(); }
            catch (err) { console.log(err); }
            // finally {}
        });
    });

})(jQuery);