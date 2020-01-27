"use strict";
$(function() {
    const $table = $("#restaurants")

    const background_style = 'background-color:#CCF'

    $table.find("td").click(function(){
        $('table tr > td, table tr > th').attr('style', 'background-color:none;')
        const $this = $(this)
        index = $this.parent().children().index($this) + 1
        $('table tr > td:nth-child(' + index + ')').attr('style', background_style)
        $('table tr > th:nth-child(' + index + ')').addClass('selected')
    })

    let $select = $("#groceries")
    $select.click((event)=>{
        $('.selected').removeClass('.selected')
        $(event.currentTarget).find("li").addClass('selected')
    })

    $select = $("#directions")
    $select.click((event)=>{
        $('.selected').removeClass('.selected')
        $(event.currentTarget).find("li").addClass('selected')
    })

    // $select = $("#directions")
    // $select.click((event)=>{
    //     $()
    //     $(event.currentTarget).find("li").attr('style', background_style)
    // })

    // $select = $("#directions")
    // $select.click(()=>{
    //     $this = $(this)
    //     $('ul > li, ol > li', $select).attr('style', 'background-color:none;')
    //     $('ul > li, ol > li', $select).attr('style', background_style)
    // })

    // function select(){
    //     select_list()
    //     select_row()
    //     select_column()
    //     select_multi()
    // }

    var mouse_x;
    var mouse_y;

    // always track mouse position
    $(document).mousemove(function(event) {
        mouse_x = event.pageX;
        mouse_y = event.pageY;
    })

    function gesture_recognizer(trail) {
        const selector = 'up' // 'down'
        switch(x) {
          case 'up':
            select_column()
            break
          case 'down':
            select_rows()
            select_list()
            break
          default:
        }
    }

    function gesture_start(selector){
        var element = document.elementFromPoint(mouse_x, mouse_y)
        const type = element.is()
        switch(type) {
          case 'LI':
            break
          case 'TR':
            break
          default:
            break
        }
    }

    function gesture_stop(selector){

    }

    function select_random(selector){

    }

    function select_class(selector){

    }

    function select_list(selector){

    }

    function select_column(){

    }

    function select_row(){

    }


    function stock(){
        const name = $("#stock_input").val()
        if(name == "apple"){
            $("#stock_name").text("apple")
            $("#stock_price").text("$318.00")
        }

        if(name == "vm"){
            $("#stock_name").text("vm")
            $("#stock_price").text("$150.00")
        }
    }

    $("#stock_input").on('keyup', function (e) {
        if (e.keyCode === 13) {
            stock()
        }
    });


    $("#stock_button").on('click', ()=>{
        stock()
    })

    function speak(message) {
      // var msg = new SpeechSynthesisUtterance(message)
      // window.speechSynthesis.speak(msg)
    }

    $("button[name='say']").on('click', (event)=>{
        speak($(event.target).text())
    })

    $("#send").on('click', ()=>{
        $('textarea').val('')
        $('input').val('')
        // speak('Hello, world')
    })

    let current_click = ""
    $('body').on('click', (event)=>{
        current_click = event.target.tagName

    })

    if (annyang) {
        var commands = {
            'this is a *var_name': tag_variable,
            'this is an *var_name': tag_variable,
            'from here': gesture_start,
            'to here': gesture_start
        };

        annyang.addCommands(commands);
        annyang.start()

        annyang.addCallback('result', function(whatWasHeardArray) {
            console.log('result')
            console.log(whatWasHeardArray)
            $("#transcript").text(whatWasHeardArray[0])
        })

        annyang.addCallback('start', function(whatWasHeardArray) {
            $("#transcript").text('[start]')
        })

        annyang.addCallback('soundstart', function() {
            $("#transcript").text('[soundstart]')
        })
    }

    function tag_variable(var_name){
        if(current_click == 'TEXTAREA'){
            replaceSelectedTextArea($('textarea')[0], "[" + var_name + "] ")
        }

        if(current_click == 'INPUT'){
            replaceSelectedInput($('input')[0], "[" + var_name + "] ")
        }
    }

    function getInputSelection(el) {
        var start = 0, end = 0, normalizedValue, range,
            textInputRange, len, endRange;

        if (typeof el.selectionStart == "number" && typeof el.selectionEnd == "number") {
            start = el.selectionStart;
            end = el.selectionEnd;
        } else {
            range = document.selection.createRange();

            if (range && range.parentElement() == el) {
                len = el.value.length;
                normalizedValue = el.value.replace(/\r\n/g, "\n");

                // Create a working TextRange that lives only in the input
                textInputRange = el.createTextRange();
                textInputRange.moveToBookmark(range.getBookmark());

                // Check if the start and end of the selection are at the very end
                // of the input, since moveStart/moveEnd doesn't return what we want
                // in those cases
                endRange = el.createTextRange();
                endRange.collapse(false);

                if (textInputRange.compareEndPoints("StartToEnd", endRange) > -1) {
                    start = end = len;
                } else {
                    start = -textInputRange.moveStart("character", -len);
                    start += normalizedValue.slice(0, start).split("\n").length - 1;

                    if (textInputRange.compareEndPoints("EndToEnd", endRange) > -1) {
                        end = len;
                    } else {
                        end = -textInputRange.moveEnd("character", -len);
                        end += normalizedValue.slice(0, end).split("\n").length - 1;
                    }
                }
            }
        }

        return {
            start: start,
            end: end
        };
    }

    function replaceSelectedInput(el, text) {
        $(el).val(text)
    }

    function replaceSelectedTextArea(el, text) {
        var sel = getInputSelection(el), val = el.value;
        el.value = val.slice(0, sel.start) + text + val.slice(sel.end);
    }
})
