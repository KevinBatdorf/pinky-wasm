export const example = `x := 3
y := 2 * (x + 4)
z := y - x / 2

func add(a, b)
  ret a + b
end

result := add(x, y)
println("add(x, y) = " + result)


func outer()
  func inner()
    println("Inside inner")
  end
  inner()
  println("Inside outer")
end
outer()


if x > 5 then
  println("x is greater than 5")
elif x == 5 then
  println("x is exactly 5")
else
  println("x is less than 5")
end

-- While loop with inline print (comma-separated)
i := 1
print("Counting: ")
while i <= 5 do
  print(i)
  if i < 5 then
    print(", ")
  else
    println("")  -- newline at end
  end
  i := i + 1
end


for j := 1, j <= 3, j + 1 do
  println("For loop: " + j)
end


flag := not false and true
println("flag is: " + flag)


add(10, 20)
`;
