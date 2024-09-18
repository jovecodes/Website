const operators = "^+-*/";
const is_alpha  = /^[A-Z]$/i;
const is_num    = /^\d/;

class Lexer {
    constructor(text) {
        this.text = text;
        this.index = 0;
        this.tokens = [];
    }

    has_more() {
        return this.index < this.text.length;
    }

    lex_next() {
        while (this.has_more() && this.text[this.index] == ' ')  {
            this.index += 1;
        }
        if (!this.has_more()) return false;

        const op_index = operators.indexOf(this.text[this.index]);
        if (op_index != -1) {
            this.index += 1; 
            this.tokens.push(operators[op_index]);
            return true;
        }

        let token = "";
        if (is_alpha.test(this.text[this.index])) {
            while (is_alpha.test(this.text[this.index])) {
                token += this.text[this.index];
                this.index += 1;
            }
        } else if (is_num.test(this.text[this.index])) {
            while (is_num.test(this.text[this.index])) {
                token += this.text[this.index];
                this.index += 1;
            }
            while (this.has_more() && this.text[this.index] == ' ')  {
                this.index += 1;
            }
            if (this.has_more() && is_alpha.test(this.text[this.index])) {
                this.tokens.push(token);
                this.tokens.push("*");
                return true;
            }
        } else {
            throw new Error(`Unknown character '${this.text[this.index]}'`)
        }
        this.tokens.push(token);
        return true;
    }

    tokenize() {
        while (this.lex_next()) {}
        return this.tokens;
    }
}

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.index = 0; // Tracks current position in the token list
    }

    precedence(op) {
        switch (op) {
            case '+': return 0;
            case '-': return 0;
            case '*': return 1;
            case '/': return 1;
            case '^': return 2;
            default: return -1;
        }
    }

    // Parse a primary token coefficient
    parse_primary() {
        let node;
        if (is_alpha.test(this.tokens[this.index])) {
            node = { lhs: null, op: null, rhs: null, value: null, var: this.tokens[this.index] };
        } else if (is_num.test(this.tokens[this.index])) {
            node = { lhs: null, op: null, rhs: null, value: Number(this.tokens[this.index]), var: null };
        } else {
            throw new Error(`Could not parse primary ast node of ${this.tokens[this.index]}`)
        }

        this.index += 1;

        return node;
    }

    parse_expression_1(lhs, min_precedence) {
        let lookahead = this.tokens[this.index];

        while (this.precedence(lookahead) >= min_precedence) {
            let op = lookahead;
            this.index += 1;

            let rhs = this.parse_primary();
            lookahead = this.tokens[this.index];

            // Handle higher precedence or right-associative operators like '^'
            while (this.precedence(lookahead) > this.precedence(op) || lookahead === '^') {
                const op_prec = this.precedence(op);
                rhs = this.parse_expression_1(rhs, op_prec + (this.precedence(lookahead) > op_prec ? 1 : 0));
                lookahead = this.tokens[this.index];
            }
            lhs = { lhs: lhs, op: op, rhs: rhs, value: null, var: null };
        }

        return lhs;
    }

    parse_expression() {
        let primary = this.parse_primary();
        return this.parse_expression_1(primary, 0);
    }
}

function apply(left, op, right) {
    let l = left == null ? 0 : left;
    let r = right == null ? 0 : right;

    switch (op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return l / r;
        case '^': return l ** r;
        default: throw new Error(`unknown operator '${op}'`);
    }
}

function eval_ast(ast, variables) {
    if (ast == null) return 0;

    if (ast.value != null) {
        return ast.value;
    }
    if (ast.var != null) {
        return variables.get(ast.var);
    }

    return apply(eval_ast(ast.lhs, variables), ast.op, eval_ast(ast.rhs, variables));
}

const ATTEMPTS = 100;

function find_zero(test) {
    let x = 0;
    let last_value = test(x, false);
    let step = 1;

    let found = false;
    let just_switched = false;

    for (let i = 0; i <= ATTEMPTS; ++i) {
        let new_value = test(x, false);
        
        if (new_value === 0) {
            found = true;
            test(x, true);
            break;
        }

        if (Math.abs(new_value) > Math.abs(last_value)) {
            step = -step; // getting futher away so we need to switch directions
            if (just_switched) {
                step /= 2;
            }
            just_switched = true;
        } else {
            just_switched = false;
        }

        last_value = new_value;
        x += step;
    }

    if (!found) {
        results.innerHTML += `Could not a find zero after ${ATTEMPTS} attempts the closest found was (${x}, ${test(x, false)})`;
    }

    return {found: found, x: x};
}

function get_coefficients(ast, has_multiplication = false) {
    has_multiplication |= ast.op == '*';

    if (ast.value != null) return [ast.value];
    
    if (!has_multiplication && ast.var != null) return [1];
    
    if (ast.op == '^') return get_coefficients(ast.lhs, has_multiplication);

    let cs = [];
    if (ast.lhs != null) {
        cs = cs.concat(get_coefficients(ast.lhs, has_multiplication));
    }
    if (ast.rhs != null) {
        cs = cs.concat(get_coefficients(ast.rhs, has_multiplication));
    }
    return cs;
}

function get_dividing_polynomial(divisor) {
    if (divisor < 0) return `(x + ${Math.abs(divisor)})`;
    else             return `(x - ${Math.abs(divisor)})`;
}

function synthetic_division(ast, res) {
    // commence synthetic division
    let divisor = res.x;

    let html = "";

    html += '<br/><br/>';
    html += `Division: (${equation.value}) / ${get_dividing_polynomial(divisor)}`;

    html += '<br/><br/>';
    html += `Synthetic division: <br/>`;

    let coefficients = get_coefficients(ast);

    // Create the table for grid alignment
    let table = '<table style="border-collapse: collapse;">';

    // First row: original coefficients
    table += '<tr>';
    table += `<td rowspan="1">${divisor} |</td>`;  // Divisor on the left, spanning two rows

    for (let i = 0; i < coefficients.length; ++i) {
        let num = coefficients[i].toString().padStart(3, ' ');
        table += `<td style="border: 1px solid black; padding: 5px; text-align: center;">${num}</td>`;
    }
    table += '</tr>';

    // Second row: remainders and results
    let remainders = [];
    table += '<tr>';
    for (let i = 1; i < coefficients.length; ++i) {
        remainders.push(coefficients[i - 1] * divisor);
        coefficients[i] += coefficients[i - 1] * divisor;
    }

    table += '<td> </td><td> </td>';
    for (let i = 0; i < remainders.length; ++i) {
        let remainderNum = remainders[i].toString().padStart(3, ' ');
        table += `<td style="border: 1px solid black; padding: 5px; text-align: center;">${remainderNum}</td>`;
    }
    table += '</tr>';

    // Final row: synthetic division result
    table += '<tr>';
    table += '<td> </td>'; // Add another middle column separator
    for (let i = 0; i < coefficients.length; ++i) {
        let num = coefficients[i].toString().padStart(3, ' ');
        table += `<td style="border: 1px solid black; padding: 5px; text-align: center;">${num}</td>`;
    }
    table += '</tr>';
    table += '</table>';

    // Append the table to the results
    html += table;

    return {html: html, coefficients: coefficients};
}

function get_degree(ast) {
    if (ast == null) return 0;
    if (ast.op == '^') return ast.rhs.value;
    return Math.max(get_degree(ast.lhs, ast.rhs));
}

function get_polynomial_for_syn_division(division) {
    let new_polynomial = "";
    for (i = division.coefficients.length - 1; i > 0; --i) {
        if (division.coefficients[i] != 0) {
            let text = "";
            if (division.coefficients[i] != 1) {
                text += division.coefficients[i];
            }
            text += "x";
            if (i != 1) {
                text += `^${i}`;
            }

            let j = i - 1;
            while (j != 0 && division.coefficients[j] === 0) j--;

            console.log(division.coefficients[j]);
            if (division.coefficients[j] > 0) {
                text += " + ";
            } else {
                text += " - ";
            }

            new_polynomial += text;
        }
    }
    new_polynomial += division.coefficients[0];
    return new_polynomial;
}

function simplify() {
    const equation = document.getElementById("equation")
    const results = document.getElementById("results")
    results.innerHTML = ""
    console.log(equation.value);

    let lexer = new Lexer(equation.value);
    let tokens = lexer.tokenize();

    let parser = new Parser(tokens);
    let ast = parser.parse_expression();
    console.log(ast);

    let variables = new Map();

    let add_newline = false;
    let test = (val, log) => {
        variables.set('x', val);

        let value = eval_ast(ast, variables);
        if (log) {
            if (add_newline) {
                results.innerHTML += '<br/>';
            } else {
                add_newline = true;
            }

            results.innerHTML += `x = ${val} => ${value}`;
        }

        return value;
    }

    const x_val = document.getElementById("x-value");
    if (x_val.value) {
        test(Number(x_val.value), true);
    } else {
        let res = find_zero(test);
        if (res.found) {
            let division = synthetic_division(ast, res);
            results.innerHTML += division.html;

            results.innerHTML += "<br/><br/>";
            results.innerHTML += `(${get_polynomial_for_syn_division(division)})${get_dividing_polynomial(res.x)}`;
        }
    }
}

function set_degree() {
    const equation = document.getElementById("equation")
    const degree = document.getElementById("degree");

    if (!degree) return
    
    equation.value = "";
    for (i = Number(degree.value); i >= 0; --i) {
        if (i == 0) {
            equation.value += `1`;
        } else if (i == 1) {
            equation.value += `x`;
        } else {
            equation.value += `x^${i}`;
        }
        if (i != 0) equation.value += " + ";
    }
}

(() => {
    const simplify_button = document.getElementById('simplify');
    simplify_button.addEventListener('click', simplify);

    const set_degree_button = document.getElementById('set-degree');
    set_degree_button.addEventListener('click', set_degree);
})()
