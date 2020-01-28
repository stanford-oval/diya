"use strict";
$(function() {

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
