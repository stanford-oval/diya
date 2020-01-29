"use strict";
$(function() {


    const selection = Selection.create({

        // Class for the selection-area
        class: 'selection',

        // All elements in this container can be selected
        selectables: ['.box-wrap > div'],

        // The container is also the boundary in this case
        boundaries: ['.box-wrap']
    }).on('start', ({inst, selected, oe}) => {

        // Remove class if the user isn't pressing the control key or ⌘ key
        if (!oe.ctrlKey && !oe.metaKey) {

            // Unselect all elements
            for (const el of selected) {
                el.classList.remove('selected');
                inst.removeFromSelection(el);
            }

            // Clear previous selection
            inst.clearSelection();
        }

    }).on('move', ({changed: {removed, added}}) => {

        // Add a custom class to the elements that where selected.
        for (const el of added) {
            el.classList.add('selected');
        }

        // Remove the class from elements that where removed
        // since the last selection
        for (const el of removed) {
            el.classList.remove('selected');
        }

    }).on('stop', ({inst}) => {
        
        // Remember selection in case the user wants to add smth in the next one
        inst.keepSelection();
    });

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


    function get_row(){
        
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
})
