/*global WebSocket*/
(function () {
    "use strict";

    var doc = document,
        sock = new WebSocket('ws://localhost:8080'),
        term = new Term('term'),

        // TODO:  Fill sequences
        KEY_BACK_SPACE = "Backspace",
        KEY_DELETE = "Delete",
        KEY_ESCAPE = "Escape",
        KEY_RETURN = "Return",
        KEY_TAB = "Tab",
        KEY_LEFT_ARROW = "Left",
        KEY_RIGHT_ARROW = "Right",
        KEY_DOWN_ARROW = "Down",
        KEY_UP_ARROW = "Up",

        // Map of escape sequences for invisible characters
        KEY_MAP = [
            [KEY_BACK_SPACE, ""],
            [KEY_TAB,        "	"],
            [KEY_RETURN,     "\n"],
            [KEY_ESCAPE,     ""],
            [KEY_DELETE,     ""]
        ].reduce(fillMap, {}),

        // Map for firefox for translating keyCode to key
        KEY_CODE_MAP = [
            [0x08, KEY_BACK_SPACE],
            [0x09, KEY_TAB],
            [0x0D, KEY_RETURN],
            [0x1B, KEY_ESCAPE],
            [0x2E, KEY_DELETE],
            [0x7B, KEY_LEFT_ARROW],
            [0x7C, KEY_RIGHT_ARROW],
            [0x7D, KEY_DOWN_ARROW],
            [0x7E, KEY_DOWN_ARROW]
        ].reduce(fillMap, []),

        ESC_SEQ_START = "",
        ESC_SEQ_RE = /^\[[0-9;]*[a-zA-Z0-9]/,
        ESC_SEQ_EXT_CHAR_CODE = String.charCodeAt("["),
        ESC_SEQ_DISP_CHAR_CODE = String.charCodeAt("m"),

        CHAR_CODE_0 = String.charCodeAt("0"),
        CHAR_CODE_9 = String.charCodeAt("9"),
        CHAR_CODE_COLON = String.charCodeAt(";"),

        DISPLAY_BRIGHT_CLS = "bright",
        DISPLAY_DIM_CLS = "dim",
        DISPLAY_UNDERSCORE_CLS = "underscore",
        DISPLAY_BLINK_CLS = "blink",
        DISPLAY_REVERSE_CLS = "reverse",
        DISPLAY_HIDDEN_CLS = "hidden",

        DISPLAY_FG_CLS_PREFIX = "fg-",
        DISPLAY_BG_CLS_PREFIX = "bg-",

        DISPLAY_COLOR_CLS_MAP = [
            "black",
            "red",
            "green",
            "yellow",
            "blue",
            "magenta",
            "cyan"
        ];


    function fillMap(map, item) {
        map[item[0]] = item[1];
        return map;
    }

    function Term(id) {
        var me = this,
            el = doc.getElementById(id),
            handlers = {},
            activeTextNode;
        
        function onKeyPress(event) {
            var char = event.char || String.fromCharCode(event.charCode);

            // If char is 0, then we need to llokup proper escape sequence
            // for non printable characters
            if (char === '\0') {
                try {
                    char = KEY_MAP[event.key || KEY_CODE_MAP[event.keyCode]];
                } catch (err) {}
                if (!char) {
                    console.warn('Unknown key pressed: ', event.key || event.keyCode);
                }
            }

            // Forward to terminal only if proper character string was found and
            // ressed sequence did not include metaKey (Cmd on Mac)
            if (char != '\0' && !event.metaKey) {
                emit('input', {data: char});
                if (! event.metaKey) {
                    event.preventDefault();
                }
            }
        }

        function emit(type, event) {
            var fns = handlers[type],
                i, l = fns ? fns.length : 0;
            event.type = type;
            event.target = me;
            for (i = 0; i < l; i++) {
                fns[i](event);
            }
        }

        function addEventListener(name, cb) {
            if (!handlers[name]) {
                handlers[name] = [];
            }
            handlers[name].push(cb);
        }

        function clear() {
            this.el.innerHTML = '';
        }

        /**
         * Set display attributes
         *
         * @param {String} attr Display attribute, beeing one of
         */
        function setDisplay(attrs){
            var span,
                num,
                cls,
                i, l;
            
            if (activeTextNode && activeTextNode.data.length == 0) {
                span = activeTextNode.parentNode;
            } else {
                activeTextNode = doc.createTextNode('');
                span = doc.createElement('span');
                span.appendChild(activeTextNode);
                el.appendChild(span);
            }

            for (i = 0, l = attrs.length; i < l; i++) {
                num = parseInt(attrs[i]);
                switch (num) {
                case 0:
                    span.className = "";
                    break;
                case 1:
                    cls = DISPLAY_BRIGHT_CLS;
                    span.classList.remove(DISPLAY_DIM_CLS);
                    break;
                case 2:
                    cls = DISPLAY_DIM_CLS;
                    span.classList.remove(DISPLAY_BRIGHT_CLS);
                    break;
                case 4:
                    cls = DISPLAY_UNDERSCORE_CLS;
                    break;
                case 5:
                    cls = DISPLAY_BLINK_CLS;
                    break;
                case 6:
                    cls = DISPLAY_REVERSE_CLS;
                    break;
                case 7:
                    cls = DISPLAY_HIDDEN_CLS;
                    break;
                default:
                    cls = (num < 40) ? DISPLAY_FG_CLS_PREFIX : DISPLAY_BG_CLS_PREFIX;
                    cls += DISPLAY_COLOR_CLS_MAP[num % 10];
                }
                span.classList.add(cls);
            }
        }

        /**
         * Process escape sequence from chunk at given index
         * @private
         * @param {String} chunk Text chunk
         * @param {Number} index Index, where escape sequence starts, after esc char
         * @return {Number} Index of first character after esc sequence
         */
        function processEscSequence(chunk, start) {
            var i = start, 
                l = chunk.length,
                charCode = String.charCodeAt(chunk[i]);

            if (charCode == ESC_SEQ_EXT_CHAR_CODE) {
                do {
                    charCode = String.charCodeAt(chunk[++i]);
                } while ((charCode >= CHAR_CODE_0 && charCode <= CHAR_CODE_9) || charCode == CHAR_CODE_COLON);
            }

            // TODO: implement remainig commads
            switch(charCode) {
            case ESC_SEQ_DISP_CHAR_CODE:
                setDisplay(chunk.slice(start + 1, i).split(';'));
                break;
            default:
                console.warn('Recived unknown escape sequence: ', chunk.slice(start, i + 1));
            }
            return (i + 1);
        }

        function pushChunk(chunk, from, to) {
            activeTextNode.data += chunk.slice(from, to);
        }

        /**
         * Print chunk of data to terminal, with processing escape sequences
         */
        function print(chunk) {
            var printedI = 0,
                i = 0,
                l = chunk.length;

            for (; i < l; i++) {
                if (chunk[i] === ESC_SEQ_START) {
                    pushChunk(chunk, printedI, i);
                    // TOOD: what ebout escape sequences, which goes beyond one chunk
                    printedI = processEscSequence(chunk, i + 1);
                    i = printedI - 1;
                }
            }
            pushChunk(chunk, printedI, i);
        }

        el.addEventListener('keypress', onKeyPress);
        setDisplay(0);

        this.el = el;
        this.addEventListener = addEventListener;
        this.clear = clear;
        this.print = print;
        this.setDisplay = setDisplay;
    };

    sock.addEventListener('open', function () {
        term.clear();
    });

    sock.addEventListener('message', function (event) {
        term.print(event.data);
    });

    term.addEventListener('input', function (event) {
        sock.send(event.data);
    });
}());
