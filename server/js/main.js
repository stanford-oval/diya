'use strict';

// Handle session token sent from extension
let sessionToken;

document.addEventListener('NewSessionToken', function (event) {
    sessionToken = event.token;
});


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

const executeProcedure = async progName => {
    console.log(sessionToken);
    await axios.post('/recorder/add-event', {
        action: 'RUN_PROGRAM',
        varName: progName,
        token: sessionToken,
    });
};

const updateProcedures = async () => {
  const procedures = await getProcedures();

  $('#procedure-list').empty();
  procedures.map(proc => {
    $('#procedure-list').append(
      `<li>
            <div id='procedure-card' class='card'>
                <div class='card-body'>
                    <h5 class='card-title procedure-card-title'>
                        <a data-name='${proc.name}'>${proc.prettyName}</a>
                    </h5>
                    <p><b>Required arguments:</b> ${
                        proc.args.length > 0 ? proc.args.join(', ') : 'None'
                    }</p>
                    <pre>${proc.code}</pre>
                </div>
            </div>
        </li>`,
    );
  });

  // Add click listeners to handle procedure execution
  document.querySelectorAll('.procedure-card-title').forEach(card => {
    card.addEventListener('click', (e) => {
        executeProcedure(e.srcElement.getAttribute('data-name'));
    });
  });
};

updateProcedures();
