export const example = `x := 0
pi := 3.141592
name := 'Pinky'

-----------------------------------------------
-- Find the max value between two numbers
-----------------------------------------------
func max(a, b)
if a > b then
    ret a
end
    ret b
end

-----------------------------------------------
-- Compute the factorial of a number
-----------------------------------------------
func factorial(n)
    if n <= 1 then
        ret 1
    else
        ret n * factorial(n - 1)
    end
end

-----------------------------------------------
-- Start procedure
-----------------------------------------------
func main(a, b)
    i := 0
    while i <= 10 do
        print(i)
        i := i + 1
    end
    for i := 1, 10 do
        print(factorial(i))
    end
end

main()
`;
