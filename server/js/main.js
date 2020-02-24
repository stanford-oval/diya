'use strict';
$(function() {
  $('.button_reserve').on('click', e => {
    let restaurant_name = $(e.target).attr('name');
    $('#reservation_result').text('Reserved "' + restaurant_name + '"');
  });

  function stock() {
    const name = $('#stock_input').val();
    if (name === 'apple') {
      $('#stock_name').text('apple');
      $('#stock_price').text('$318.00');
    }

    if (name === 'vm') {
      $('#stock_name').text('vm');
      $('#stock_price').text('$150.00');
    }
  }

  $('#stock_input').on('keyup', function(e) {
    if (e.keyCode === 13) stock();
  });

  $('#stock_button').on('click', () => {
    stock();
  });

  // function speak(message) {
  //   var msg = new SpeechSynthesisUtterance(message)
  //   window.speechSynthesis.speak(msg)
  // }

  // $("button[name='say']").on('click', (event)=>{
  //     speak($(event.target).text())
  // })

  $('#send').on('click', () => {
    $('textarea').val('');
    $('input').val('');
    // speak('Yeah I like it when you click that button')
  });
});

/* State display stuff (i.e. App Store) */
const axios = require('axios');

const getProcedures = async () => {
    const { data } = await axios.get('/recorder/procedures');
    return data;
};

getProcedures();
