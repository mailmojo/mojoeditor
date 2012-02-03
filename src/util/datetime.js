/*
 * datetime module.
 *
 * strftime functionality based on:
 *
 * JQuery strftime plugin
 * Version 1.0.1 (12/06/2008)
 *
 * No documentation at this point, sorry.
 *
 * Home page: http://projects.nocternity.net/jquery-strftime/
 * Examples: http://projects.nocternity.net/jquery-strftime/demo.html
 *
 * Copyright (c) 2008 Emmanuel Benoît
 * 
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

define(function () {
	var strftime,
		_defaults, _useText, _finaliseObj, _dateTimeToDtObj, _objToDtObj,
		// jQuery imports
		class2type, type, isArray;

	// TODO: Abstract away these jQuery imports...
	class2type = {
		"[object Boolean]": "boolean",
		"[object Number]": "number",
		"[object String]": "string",
		"[object Function]": "function",
		"[object Array]": "array",
		"[object Date]": "date",
		"[object RegExp]": "regexp",
		"[object Object]": "object"
	};
	type = function( obj ) {
		return obj === null ?
			String( obj ) :
			class2type[ toString.call(obj) ] || "object";
	};
	isArray = Array.isArray || function( obj ) {
		return type(obj) === "array";
	};

	_defaults = {
		'days_short' : [ 'Sun', 'Mon' , 'Tue' , 'Wed' , 'Thu' ,
				'Fri' , 'Sat' ] ,
		'days_long' : [ 'Sunday' , 'Monday' , 'Tuesday' ,
				'Wednesday' , 'Thursday' , 'Friday' ,
				'Saturday' ] ,
		'months_short' : [ 'Jan' , 'Feb' , 'Mar' , 'Apr' ,
				'May' , 'Jun' , 'Jul' , 'Aug' ,
				'Sep' , 'Oct' , 'Nov' , 'Dec' ] ,
		'months_long' : [ 'January' , 'February' , 'March' ,
				'April' , 'May' , 'June' , 'July' ,
				'August' , 'September' , 'October' ,
				'November' , 'December' ] ,
		'format' : '%m/%d/%Y'
	};

	_useText = _defaults;

	_finaliseObj = function ( _obj , _month , _dow ) {
		_obj.a = _useText.days_short[ _dow ];
		_obj.A = _useText.days_long[ _dow ];
		_obj.b = _useText.months_short[ _month ];
		_obj.B = _useText.months_long[ _month ];
		_obj.m = _month + 1;

		var _tmp;

		if ( _obj.Y > 0 ) {
			_tmp = _obj.Y.toString( );
			if ( _tmp.length < 2 ) {
				_tmp = '0' + _tmp;
			} else if ( _tmp.length > 2 ) {
				_tmp = _tmp.substring( _tmp.length - 2 );
			}
			_obj.y = _tmp;
		} else {
			_obj.y = _obj.Y;
		}

		var _check = [ 'd' , 'm' , 'H' , 'M' , 'S' ];
		for ( var i in _check ) {
			_tmp = _obj[ _check[ i ] ];
			_tmp = _tmp.toString( );
			if ( _tmp.length < 2 ) {
				_tmp = '0' + _tmp;
			}
			_obj[ _check[ i ] ] = _tmp;
		}

		if (_obj.e < 10) {
			_obj.e = ' ' + _obj.e.toString();
		}

		return _obj;
	};

	_dateTimeToDtObj = function ( dateTime , utc ) {
		var _obj, _month, _dow;
		if ( utc ) {
			_obj = {
				'H' : dateTime.getUTCHours( ) ,
				'M' : dateTime.getUTCMinutes( ) ,
				'S' : dateTime.getUTCSeconds( ) ,
				'd' : dateTime.getUTCDate( ) ,
				'e' : dateTime.getUTCDate( ),
				'Y' : dateTime.getUTCFullYear( )
			};
			_month = dateTime.getUTCMonth( );
			_dow = dateTime.getUTCDay( );
		} else {
			_obj = {
				'H' : dateTime.getHours( ) ,
				'M' : dateTime.getMinutes( ) ,
				'S' : dateTime.getSeconds( ) ,
				'd' : dateTime.getDate( ) ,
				'e' : dateTime.getDate( ) ,
				'Y' : dateTime.getFullYear( )
			};
			_month = dateTime.getMonth( );
			_dow = dateTime.getDay( );
		}
		return _finaliseObj( _obj , _month , _dow );
	};

	_objToDtObj = function ( obj ) {
		var _defs = {
			'H' : 0 ,
			'M' : 0 ,
			'S' : 0 ,
			'd' : 1 ,
			'e' : 1 ,
			'Y' : 1 ,
			'm' : 1
		};
		var _dtObj = {};

		for ( var i in _defs ) {
			if ( typeof obj[ i ] != 'number' || obj[ i ] % 1 != 0 ) {
				_dtObj[ i ] = _defs[ i ];
			} else {
				_dtObj[ i ] = obj[ i ];
			}
		}

		_dtObj.m --;

		var _dow;
		if ( typeof obj.dow == 'number' && obj.dow % 1 == 0 ) {
			_dow = obj.dow;
		} else {
			_dow = 0;
		}

		return _finaliseObj( _dtObj , _dtObj.m , _dow );
	};

	strftime = function ( fmt , dateTime , utc ) {

		if ( fmt && typeof fmt == 'object' ) {
			dateTime = fmt.dateTime;
			utc = fmt.utc;
			fmt = fmt.format;
		}

		if ( !fmt || ( typeof fmt != 'string' ) ) {
			fmt = _useText.format;
		}

		var _dtObj;
		if ( dateTime && ( typeof dateTime == 'object' ) ) {
			if ( dateTime instanceof Date ) {
				_dtObj = _dateTimeToDtObj( dateTime , utc );
			} else {
				_dtObj = _objToDtObj( dateTime );
			}
		} else {
			_dtObj = _dateTimeToDtObj( new Date( ) , utc );
		}

		var _text = '' , _state = 0;
		for ( var i = 0 ; i < fmt.length ; i ++ ) {
			if ( _state == 0 ) {
				if ( fmt.charAt(i) == '%' ) {
					_state = 1;
				} else {
					_text += fmt.charAt( i );
				}
			} else {
				if ( typeof _dtObj[ fmt.charAt( i ) ] != 'undefined' ) {
					_text += _dtObj[ fmt.charAt( i ) ];
				} else {
					_text += '%';
					if ( fmt.charAt( i ) != '%' ) {
						_text += fmt.charAt( i );
					}
				}
				_state = 0;
			}
		}
		if ( _state == 1 ) {
			_text += '%';
		}

		return _text;
	};


	strftime.setText = function ( obj ) {
		if ( typeof obj != 'object' ) {
			throw new Error( 'datetime.strftime.setText() : invalid parameter' );
		}

		var _count = 0;
		for ( var i in obj ) {
			if ( typeof _defaults[ i ] == 'undefined' ) {
				throw new Error( 'datetime.strftime.setText() : invalid field "' + i + '"' );
			} else if ( i == 'format' && typeof obj[ i ] != 'string' ) {
				throw new Error( 'datetime.strftime.setText() : invalid type for the "format" field' );
			} else if ( i != 'format' && !isArray(obj[i]) ) {
				throw new Error( 'datetime.strftime.setText() : field "' + i + '" should be an array' );
			} else if ( obj[ i ].length != _defaults[ i ].length ) {
				throw new Error( 'datetime.strftime.setText() : field "' + i + '" has incorrect length '
						+ obj[ i ].length + ' (should be ' + _defaults[ i ].length + ')'
				       );
			}
			_count ++;
		}
		if ( _count != 5 ) {
			throw new Error( 'datetime.strftime.setText() : 5 fields expected, ' + _count + ' found' );
		}

		_useText = obj;
	};

	strftime.defaults = function ( ) {
		_useText = _defaults;
	};

	return {
		"strftime": strftime
	};
});

