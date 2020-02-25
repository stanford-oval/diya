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
    const args = proc.prettyArgs.reduce((acc, p, i) => {
      const and = i === 0 ? '' : ' and ';
      return `${acc}${and}<span class='procedure-arg'>${p}</span>`
    }, '')
    proc.prettyArgs.join(' and ');
    $('#procedure-list').append(
      `<li>
            <div id='procedure-card' class='card'>
                <div class='card-body'>
                    <h5 class='card-title procedure-card-title text-muted'>
                        <a data-name='${proc.name}'>
                            Call <span class='procedure-name'>${proc.prettyName}</span>${args ? ' with ' + args : ''}
                        </a>
                    </h5>
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
