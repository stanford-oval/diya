"use strict";
$(function() {
    const $table = $("#restaurants")

    const background_style = 'background-color:#CCF'

    $table.find("td").click(function(){
        $('table tr > td, table tr > th').attr('style', 'background-color:none;')
        const $this = $(this)
        const index = $this.parent().children().index($this) + 1
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
