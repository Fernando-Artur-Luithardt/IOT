#pragma once
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <cmath>
#include <algorithm>
#include <string>
using byte = uint8_t;
using std::isnan;
#define F(x) x
#define A0 0
#define A1 1
#define HIGH 1
#define LOW 0
#define OUTPUT 1
#define DHT22 22
#define WL_CONNECTED 3
#define WL_NO_SHIELD 255
inline unsigned long fakeNow = 0;
inline int fakeSolo = 0, fakeLuz = 0;
inline int outputs[70] = {};
inline float fakeTemp = 30;
inline unsigned long millis() { return fakeNow; }
inline void pinMode(int, int) {}
inline void digitalWrite(int pin, int value) { outputs[pin] = value; }
inline int analogRead(int pin) { return pin == A1 ? fakeSolo : fakeLuz; }
inline long map(long x, long a, long b, long c, long d) { return (x-a)*(d-c)/(b-a)+c; }
inline int constrain(int x, int a, int b) { return std::clamp(x,a,b); }
inline char* dtostrf(double value, int, unsigned precision, char* out) { std::snprintf(out,16,"%.*f",precision,value); return out; }
class Print {
 public:
  virtual size_t write(uint8_t) { return 1; }
  template<class... T> void print(T...) {}
  template<class... T> void println(T...) {}
};
class Stream: public Print {
 public:
  virtual int available() = 0;
  virtual int read() = 0;
  virtual int peek() = 0;
  virtual void flush() = 0;
};
class FakeSerial: public Stream {
 public:
  void begin(unsigned long) {}
  int available() override { return 0; }
  int read() override { return -1; }
  int peek() override { return -1; }
  void flush() override {}
};
inline FakeSerial Serial, Serial1;
inline int Wire = 0;
class DHT {
 public:
  DHT(int,int) {}
  void begin() {}
  float readTemperature() { return fakeTemp; }
};
class LiquidCrystal: public Print {
 public:
  LiquidCrystal(int,int,int,int,int,int) {}
  void begin(int,int) {}
  void setCursor(int,int) {}
};
class WiFiClient { public: void stop() {} };
inline struct FakeWifi {
  bool init(Stream&) { return true; }
  bool setPersistent(bool) { return true; }
  bool setAutoConnect(bool) { return true; }
  const char* firmwareVersion() { return "1.7.6.0"; }
  const char* localIP() { return "192.0.2.1"; }
  int getLastDriverError() { return 0; }
  uint8_t status() { return WL_CONNECTED; }
  uint8_t begin(const char*,const char*) { return WL_CONNECTED; }
} WiFi;
inline void (*publishHook)() = nullptr;
inline std::string lastPayload;
class PubSubClient {
 public:
  void setClient(WiFiClient&) {}
  void setServer(const char*,int) {}
  void setSocketTimeout(int) {}
  void setKeepAlive(int) {}
  void setBufferSize(int) {}
  bool connected() { return true; }
  int state() { return 0; }
  void loop() {}
  bool connect(const char*,const char*,int,bool,const char*) { return true; }
  bool publish(const char*,const char* payload,bool) {
    lastPayload = payload;
    if (publishHook) publishHook();
    return true;
  }
};
