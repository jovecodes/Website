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

function simplify() {
    const equation = document.getElementById("equation")
    const results = document.getElementById("results")
    results.innerHTML = ""
    console.log(equation.value);

    let lexer = new Lexer(equation.value);
    let tokens = lexer.tokenize();

    let parser = new Parser(tokens);
    let ast = parser.parse_expression();

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

        return value === 0;
    }

    const x_val = document.getElementById("x-value");
    if (x_val.value) {
        test(Number(x_val.value), true);
    } else {
        for (i = -10; i <= 10; ++i) {
            if (test(i, false)) {
                test(i, true);
                break;
            }
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
