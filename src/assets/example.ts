export const example = `print "hello "
println "world"
x := 5
y := "3"
z := 10
println ""
print "x * -z = "
println x * -z
println true
println 2 * 6
print "4 % 3 = "
println 4 % 3
print "2 ^ 5 = "
println 2 ^ 5
println 2 ^ .5 -- unsupported (int only allowed for exp)
println 10 ^ -1
println 2 / 6
println 2 > 4
print "heck yeah!"
-- right now only print/println are implemented
-- for the wasm compiler
-- but the lexer and parser are fully functional
`;
