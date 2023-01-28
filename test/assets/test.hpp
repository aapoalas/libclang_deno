// my_class.h
#ifndef MY_CLASS_H // include guard
#define MY_CLASS_H

namespace N {
class my_class {
public:
#ifdef __linux__
  [[deprecated("Boost it")]]
#endif
  void do_something();
private:
  int foo;
};
} // namespace N

#endif /* MY_CLASS_H */