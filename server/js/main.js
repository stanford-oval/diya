$( document ).ready(function() {


	// $(`<form>
	// 	First name:<br>
	// 	<input type="text" name="firstname"><br>
	// 	Last name:<br>
	// 	<input type="text" name="lastname">
	// </form>`).appendTo('body')

	// let events = []
	//
	// rrweb.record({
	// 	emit(event) {
	// 		events.push(event);
	// 	},
	// });

	// // this function will send events to the backend and reset the events array
	// function save() {
	// 	console.log(events)
	// 	// const body = JSON.stringify({ events });
	// 	events = [];
	// 	// fetch('http://YOUR_BACKEND_API', {
	// 	//   method: 'POST',
	// 	//   headers: {
	// 	//     'Content-Type': 'application/json',
	// 	//   },
	// 	//   body,
	// 	// });
	// }
	//
	// // save events every 10 seconds
	// setInterval(save, 10 * 1000);

	// var count = 1;
	// function setColor(btn, color) {
	// 	// btn.css({
	// 	// 	color: 'red'
	// 	// })
	// 	// // var property = document.getElementById(btn);
	// 	// // if (count == 0) {
	// 	// // 	property.style.backgroundColor = "#FFFFFF"
	// 	// // 	count = 1;
	// 	// // }
	// 	// // else {
	// 	// // 	property.style.backgroundColor = "#7FFF00"
	// 	// // 	count = 0;
	// 	// // }
	// }

	button1 = $(`<button>`, {
		type: 'button',
		class: 'btn btn-primary',
		text: 'Primary'
	}).appendTo('body')

	function setColor(){
		button_text = button1.text()
		button1.text(button_text + "1")
	}

	button1.on('click', setColor)


	// dialogue = [
	// 	{q: "what would you like to do?", f: ""},
	// 	//I'd like to add a button
	// 	{q: "where would like you like to put the button?", f: "button_move()"},
	// 	//I'd like to add a button
	// 	{q: "where would like you like the button to do?", f: "none()"},
	// 	//share
	// 	{q: "what would you like the button to say?", f: "none()"},
	// 	//change text
	// 	{q: "who do you want to share it with?", f: "button_title()"},
	// 	//someone
	// 	{q: "how do you want to share it with them?", f: "none()"},
	// 	//
	// 	{q: "what color do you want the button?", f: "none()"},
	// 	//green
	// 	{q: "done", a: "button_color()"},

	// when do you want this to show?
	// 	{q: "done", a: "button_color()"},

	// ]

	// Instantiate a mus object
	var mus = new Mus();

	// Start recording
	mus.record();

	// After a while, stops
	setTimeout(function() {
		mus.stop();
		mus.setPlaybackSpeed(mus.speed.SLOW);
		// Starts playing and enjoy
		mus.play();
	}, 5000);

	chat = $("<div>",  {
		id: "chat"
	}).appendTo('body')

	chatWindow = new Bubbles(
		chat[0],
		"chatWindow", {
			animationTime: 0,
			typeSpeed: 0,
			inputCallbackFn: function(o) {

				standingAnswer = o.standingAnswer
				input_user = o.input

				console.log('standingAnswer: ' + standingAnswer)
				switch (standingAnswer) {
					case 'button_share':
						console.log('button_share_swtich')
						chatWindow.talk(convo, "button_label")
						break;
					case 'button_label':
						button.text(input_user)
						chatWindow.talk(convo, "button_color")
						break;
					case 'button_color':
						color = button_color(input_user)
						button.attr("class", color)
						chatWindow.talk(convo, "end")
						break;
					default:
				}

				// chatWindow.talk({
				// 	"i-dont-get-it": {
				// 		says: ["Thank you"],
				// 	}
				// }, "i-dont-get-it")

				// // add error conversation block & recall it if no answer matched
				// var miss = function() {
				// 		chatWindow.talk({
				// 			"i-dont-get-it": {
				// 				says: ["Sorry, I don't get it 😕. Pls repeat? Or you can just click below 👇"],
				// 				reply: o.convo[o.standingAnswer].reply
				// 			}
				// 		}, "i-dont-get-it")
				// }
				//
				// // do this if answer found
				// var match = function(key) {
				// 	setTimeout(function() {
				// 		chatWindow.talk(convo, key) // restart current convo from point found in the answer
				// 	}, 200)
				// }
				//
				// // sanitize text for search function
				// var strip = function(text) {
				// 	return text.toLowerCase().replace(/[\s.,\/#!$%\^&\*;:{}=\-_'"`~()]/g, "")
				// }
				//
				// // search function
				// var found = false
				// o.convo[o.standingAnswer].reply.forEach(function(e, i) {
				// 	strip(e.question).includes(strip(o.input)) && o.input.length > 0 ? (found = e.answer) : found ? null : (found = false)
				// })
				// found ? match(found) : miss()
			}
		}
	)


	function button_color(color){
		switch (color) {
			case 'blue':
				break
			case 'gray':
				button.attr("class", "btn btn-secondary")
				break
			case 'green':
				button.attr("class", "btn btn-success")
				break
			case 'red':
				button.attr("class", "btn btn-danger")
				break
			case 'yellow':
				button.attr("class", "btn btn-warning")
				break
			case 'black':
				button.attr("class", "btn btn-dark")
				break
			default:
		}
	}


	$('body').append("<img src='/image/youtube.png'>")

	button = ""

	function_button_add = function() {
		console.log('button_add')
		button = $('<a>', {
			type: "button",
			class: "btn btn-primary",
			text: "button",
			target: "_blank",
			href: "https://twitter.com/intent/tweet?url=https%3A//youtu.be/T5SYu8tyKjM&text=Making%20The%20Popeyes%20Chicken%20Sandwich%20At%20Home%2C%20But%20Better&via=YouTube&related=YouTube,YouTubeTrends,YTCreators"
		}).css({
			position:'absolute',
		}).appendTo('body')

		$(document).on('mousemove', function(e){
			button.css({
				left:  e.pageX,
				top:   e.pageY
			});
		});

		setTimeout(function(){
			$(document).on('click', function(e){
				console.log("click")
				$(document).off('mousemove');
				$(document).off('click');
				chatWindow.talk(convo, "button_action")
			});
		}, 100)
	}

	function_action_share = function(){
		button = $('<button>', {
			type: "button",
			class: "btn btn-primary",
			text: 'button'
		}).css({
			position:'absolute',
		}).appendTo('body')
	}

	function_button_action = function() {
		button = $('<button>', {
			type: "button",
			class: "btn btn-primary",
			text: 'button'
		}).css({
			position:'absolute',
		}).appendTo('body')

		// chatWindow.talk(convo, "button")
	}

	var convo = {
		ice: {
			says: ["What would you like to do?"],

			reply: [
				{
					question: "Add a button",
					answer: "button_add"
				}
			]
		},

		button_add: {
			says: [
				"A button is attached to your cursor.",
				"<b>Click</b> where you would you like to put the button."
			],
			reply: [
				{
					question: "Click here to pickup button.",
					answer: "function_button_add"
				}
			]
		},

		button_share: {
			says: ["Copy the link I should use when sharing"],
			reply: [
			]
		},

		button_action: {
			says: ["What should the button do?"],
			reply: [
				{
					// done
					question: "Share",
					answer: "button_share"
				},
				{
					question: "Save",
					answer: "function_action_save"
				},
				{
					question: "Donate",
					answer: "function_action_donate"
				}
			]
		},

		button_label: {
			says: ["What should the button be labeled as?"],
			reply: [
			]
		},

		button_color: {
			says: ["What color should the button be?"],
			reply: [
			]
		},

	}
	chatWindow.talk(convo)
})


	// $('body').append("<img id='background' src='/image/amazon.png'>")


	// button = ''
	//
	// function command_send_to_server(){
	// 	line = line + 1
	//
	// 	// command = $("#transcript").val()
	// 	// $.ajax({
	// 	// 	url: "https://localhost:3000/get_thingtalk/",
	// 	// 	type: "POST",
	// 	// 	data: {
	// 	// 		command: command,
	// 	// 	},
	// 	// 	success: function(response){
	// 	// 		if(!target){
	// 	// 			alert("You need to select an element")
	// 	// 		} else {
	// 	// 			execute_tt(response)
	// 	// 		}
	// 	// 	},
	// 	// })
	//
	// 	if(line > (dialogue.length - 1)){
	// 		return
	// 	}
	//
	// 	$("#transcript").val(dialogue[line].q)
	// 	eval(dialogue[line].a)
	// }
	//
	// function none(){
	// }
	//
	// function button_title(){
	// 	button.text("Share")
	// }
	//
	//
	// function timer_10(){
	// 	setTimeout(function(){
	// 		command_send_to_server()
	// 	}, 5000)
	// }
	//
	// function translate(){
	// 	setTimeout(function(){
	// 		$("#background").attr("src", '/image/youtube2.png')
	// 	}, 5000)
	// }
	//
	// // dialogue = [
	// // 	{q: "hello", a: "none()"},
	// // 	{q: "where would like you like to put the button?", a: "button_move()"},
	// // 	{q: "where would like you like the button to do?", a: "none()"},
	// // 	{q: "what would you like the button to say?", a: "none()"},
	// // 	{q: "who do you want to share it with?", a: "button_title()"},
	// // 	{q: "how do you want to share it with them?", a: "none()"},
	// // 	{q: "what color do you want the button?", a: "none()"},
	// // 	{q: "done", a: "button_color()"},
	// // ]
	// // $('body').append("<img src='/image/youtube.png'>")
	//
	// // dialogue = [
	// // 	{q: "hello, what would you like to do?", a: "none()"},
	// 	// translate a part of the website
	// // 	{q: "what part of the website?", a: "translate()"},
	// // 	{q: "done", a: "none()"},
	// // ]
	// // $('body').append("<img id='background' src='/image/youtube.png'>")
	//
	//
	// dialogue = [
	// 	{q: "hello, what would you like to do?", a: "none()"},
	// 	// add another website
	// 	{q: "what should the website be of?", a: "timer_10()"},
	// 	// search walmart for this
	// 	{q: "where would you like it to go?", a: "website_move()"},
	// 	// here
	// 	{q: "done", a: "none()"},
	// ]
	// $('body').append("<img id='background' src='/image/amazon.png'>")
	//
	//
	// function website_move(){
	// 	button = $('<img style="position:absolute" src="/image/walmart.png" width=250px>').appendTo('body')
	// 	$(document).on('mousemove', function(e){
	// 		button.css({
	// 			left:  e.pageX,
	// 			top:   e.pageY
	// 		});
	// 	});
	// }
	//
	// line = 0
	//
	//
	// function execute_tt(response){
	// 	bottom = target[0].getBoundingClientRect()['bottom']
	// 	height = target[0].getBoundingClientRect()['height']
	// 	left = target[0].getBoundingClientRect()['left']
	// 	right = target[0].getBoundingClientRect()['right']
	// 	top = target[0].getBoundingClientRect()['top']
	// 	width = target[0].getBoundingClientRect()['width']
	// 	x = target[0].getBoundingClientRect()['x']
	// 	y = target[0].getBoundingClientRect()['y']
	//
	// 	if(response['tokens'][0] == "font"){
	// 		$(`<select>
	// 			<option value="Georgia">Georgia</option>
	// 			<option value="Times New Roman">Times New Roman</option>
	// 			<option value="Palatino Linotype">Palatino Linotype</option>
	// 		</select>`)
	// 		.attr({
	// 			id: "picker_font",
	// 		})
	// 		.css({
	// 			position: 'absolute',
	// 			left: right,
	// 			top: bottom,
	// 			zIndex: 500
	// 		})
	// 		.appendTo('html')
	//
	// 		var theInput = document.getElementById("picker_font");
	// 		var theColor = theInput.value;
	// 		theInput.addEventListener("input", function() {
	// 			target.css('font-family', theInput.value)
	// 		}, false);
	// 	}
	//
	// 	if(response['tokens'][0] == "let"){
	// 		$(`<input>`).attr({
	// 			type: "color",
	// 			id: "picker_color",
	// 			value: "#e66465",
	// 		})
	// 		.css({
	// 			position: 'absolute',
	// 			left: right,
	// 			top: bottom,
	// 			zIndex: 500
	// 		})
	// 		.appendTo('html')
	//
	// 		var theInput = document.getElementById("picker_color");
	// 		var theColor = theInput.value;
	// 		theInput.addEventListener("input", function() {
	// 			console.log("yo", theInput.value)
	// 			target.css('color', theInput.value)
	// 		}, false);
	// 	}
	//
	// 	if(response['status'] == 400){
	// 		return
	// 	}
	//
	// 	intent = response['candidates'][0]['code'][2].split('.')[2]
	// 	parameter = response['candidates'][0]['code'][6]
	//
	// 	switch (intent) {
	// 		case 'font_size_bigger':
	// 			font_size_current = parseInt(target.css('font-size')) + 10
	// 			target.css('font-size', font_size_current + "px")
	// 			break;
	//
	// 		case 'font_size_smaller':
	// 			font_size_current = parseInt(target.css('font-size'))
	// 			target.css('font-size', font_size_current - 5)
	// 			break;
	//
	// 		case 'font_color_change':
	// 			target.css('color', parameter)
	// 			break;
	//
	// 		case 'background_color_change':
	// 			target.css('background-color', parameter)
	// 			break;
	//
	// 		case 'image_change':
	// 			$('#file-input').trigger('click');
	// 			// target.css('background-color', 'red')
	// 			break;
	//
	// 		case 'font_family_change':
	// 			target.css('font-family', parameter)
	// 			break;
	//
	// 		case 'white_space_decrease':
	// 			parameter = response['candidates'][0]['code'][5].split(':')[1]
	// 			padding_top = parseInt(target.css('padding-top'))
	// 			target.css('padding-'+parameter, padding_top - 10)
	// 			break;
	//
	// 		case 'white_space_increase':
	// 			parameter = response['candidates'][0]['code'][5].split(':')[1]
	//
	// 			console.log("parameter", parameter)
	// 			padding_top = parseInt(target.css('padding-top'))
	// 			target.css('padding-'+parameter, padding_top + 10)
	// 			break;
	//
	// 		case 'drop_shadow_add':
	// 			target.css('box-shadow', '0 0 10px rgba(0, 0, 0, 0.5)')
	// 			break;
	//
	// 		case 'drop_shadow_remove':
	// 			target.css('box-shadow', '')
	// 			break;
	//
	// 		default:
	// 			console.log("default")
	// 	}
	//
	// 	// font_size_bigger
	// 	// font_size_smaller
	// 	// font_color_change
	// 	// background_color_change
	// 	// image_change
	// 	// font_family_change
	// 	// white_space_increase
	// 	// white_space_decrease
	// 	// drop_shadow_add
	// 	// drop_shadow_remove
	// 	// background_color_adjust
	// 	// font_color_adjust
	// 	// font_size_change
	// }
	//
	// $('*').on('mousedown', function (event) {
	// 	if(event.ctrlKey){
	// 		event.stopPropagation()
	// 		event.preventDefault()
	//
	// 		getSelector(event)
	// 		$(target).removeClass("hoover")
	// 		target = $(event.currentTarget)
	// 		$(target).addClass("hoover")
	//
	// 		href = target.attr("href")
	// 		$("#transcript").focus()
	// 		target.removeAttr("href")
	// 		setTimeout(()=>{
	// 			target.attr("href", href)
	// 		}, 1000)
	//
	// 		$("#picker_font").remove()
	// 		$("#color_picker").remove()
	//
	// 	}
	// })
	//
	// function getSelector(event){
	// 	let element_selected_class = $(event.target).attr('class')
	// 	if(element_selected_class){
	// 		selector = $('.' + element_selected_class)
	// 	} else {
	// 		selector = $(event.target)
	// 	}
	// }
// })
