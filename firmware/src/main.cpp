/*

The MIT License

Copyright © 2020 Juan Jose Luna Espinosa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

-----

This is yombcpu firmware, to monitor CPU usage and provide user buttons

Arduino nano's I2C pinout:

OLED display - SSD1306 128X32 pixels, monochrome
Nano    |  Display
5V      -  Vin
GND     -  GND
pin A4  -  SDA
pin A5  -  SCL


User button 0 - pin D9

Use a resistor and capacitor to mitigate signal bounces as shown in picture:

       o 5V
       |
       |
      ║║║
      ║║║  10 KOhm
      ║║║
       |
       |
D9 ----o---------------o
       |               |
        \  Button      |       4.7 microFarad
         \           ----- +   electrolytic
       |             ----- -   capacitor
       |               |
       |               |
     -----           -----
      ---             ---
       -               -

*/

// Includes

#include <Arduino.h>

#include <U8g2lib.h>

#include <Wire.h>


// Global variables


// Display

// Set 32 or 64 pixels screen height
#define SCREEN_Y 32

// Call here the proper constructor for your screen. Please see U8g2lib examples and documentation.
U8G2_SSD1306_128X32_UNIVISION_1_HW_I2C oled( U8G2_R0, U8X8_PIN_NONE);

#define MAX_CPUS SCREEN_Y
byte numCPU = 0;
byte cpuValues[ MAX_CPUS ];

byte screenBuffer[ 512 ];


// Monitor toggle button

#define BUTTON0_PIN 9

bool monitorIsOn = true;

byte prevButtons = 0x00;


// Function prototypes

void printCPUBars();
bool serialProtocol();
void draw();
byte getButtons();

//

void setup() {

	pinMode( BUTTON0_PIN, INPUT );

	oled.begin();

	oled.setContrast( 1 );

	Serial.begin( 115200 );
	delay( 500 );

	cpuValues[ 0 ] = 0;
	cpuValues[ 1 ] = 0;
	cpuValues[ 2 ] = 0;
	cpuValues[ 3 ] = 0;

	printCPUBars();


}

void loop() {


	delay( 250 );

	if ( ! serialProtocol() ) {

		cpuValues[ 0 ] = 0;
		cpuValues[ 1 ] = 0;
		cpuValues[ 2 ] = 0;
		cpuValues[ 3 ] = 0;

		printCPUBars();

		delay( 500 );
		while ( Serial.available() ) Serial.read();

	}

	printCPUBars();

}

void printCPUBars() {

	if ( ! monitorIsOn ) {

		oled.clearDisplay();
		return;

	}

	oled.firstPage();
	do {

		draw();

	} while ( oled.nextPage() );

}

void draw() {

	byte lineOffset = 0;
	byte lineHeight = 0;
	byte lineSeparation = 0;

	byte numLines = numCPU;

	byte totalLines = 1;
	while ( totalLines < numLines ) {

		totalLines <<= 1;

	}

	if ( totalLines <= ( SCREEN_Y >> 2 ) ) {

		lineOffset = ( SCREEN_Y >> 2 ) / totalLines;
		lineHeight = ( SCREEN_Y >> 1 ) / totalLines;
		lineSeparation = 2 * lineOffset + lineHeight;

	}
	else if ( totalLines <= ( SCREEN_Y >> 1 ) ) {

		lineOffset = 1;
		lineHeight = 1;
		lineSeparation = 2;

	}
	else if ( totalLines <= SCREEN_Y ) {

		lineHeight = 1;
		lineSeparation = 1;

	}

	byte y = 0;
	for ( byte i = 0; i < numLines; i ++ ) {

		byte v = cpuValues[ i ];

		if ( ( numLines & 1 ) && ( i == ( numLines - 1 ) ) ) {

			lineOffset *= numLines - 1;
			lineHeight *= numLines - 1;

			for ( byte j = 1; j <= 16; j ++ ) {

				oled.drawFrame( ( j << 3 ) - 1, y + lineOffset, 1, lineHeight );

			}

		}

		oled.drawBox( 0, y + lineOffset, v, lineHeight );

		y += lineSeparation;

	}

}

bool serialProtocol() {

	// Send one byte with up to eight flags
	// Flag 0 - Display monitor is on (flag=1) or off (flag=0)

	byte buttons = getButtons();

	byte pressedButtons = ( ~ prevButtons ) & buttons;

	byte sendButtons = 0;

	if ( pressedButtons != 0 ) {

		if ( pressedButtons & 1 ) {

			// Toggle display monitor

			monitorIsOn = ! monitorIsOn;

		}

	}

	prevButtons = buttons;

	sendButtons |= monitorIsOn ? 1 : 0;

	Serial.write( sendButtons );


	// Get up to 32 7-bit values. First byte is number of values, with MSB high.
	// The value bytes all have MSB low

	unsigned long t0 = millis();

	byte numBytes = 0;

	while ( numBytes == 0 ) {

		while ( Serial.available() == 0 ) { if ( millis() - t0 > 1000 ) return false; }

		byte b = Serial.read();

		if ( b & 128 ) {

			numBytes = b & 0x7F;

		}

	}

	numCPU = numBytes;

	if ( numCPU > MAX_CPUS ) numCPU = MAX_CPUS;

	byte numBytesRead = 0;

	t0 = millis();

	while ( numBytesRead < numBytes ) {

		while ( Serial.available() == 0 ) { if ( millis() - t0 > 1000 ) return false; }

		byte b = Serial.read();

		if ( b & 128 ) return false;

		cpuValues[ numBytesRead ++ ] = b;

	}

	return true;

}

byte getButtons() {

	return digitalRead( BUTTON0_PIN ) == LOW ? 1 : 0;

}
