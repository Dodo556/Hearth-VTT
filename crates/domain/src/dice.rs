//! Bounded game-neutral dice grammar. No scripting or production randomness here.
use serde::{Deserialize, Serialize};
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DiceError {
    Syntax,
    Limit,
    Arithmetic,
    Entropy,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Expr {
    Constant {
        value: u32,
    },
    Dice {
        count: u32,
        sides: u32,
    },
    Negate {
        value: Box<Expr>,
    },
    Binary {
        operator: Operator,
        left: Box<Expr>,
        right: Box<Expr>,
    },
}
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Operator {
    Add,
    Subtract,
    Multiply,
    Divide,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct DiceTerm {
    pub count: u32,
    pub sides: u32,
    pub faces: Vec<u32>,
    pub subtotal: u64,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Evaluation {
    pub total: f64,
    pub dice: Vec<DiceTerm>,
}
impl Expr {
    pub fn normalized(&self) -> String {
        self.format(0)
    }
    fn format(&self, minimum: u8) -> String {
        let (precedence, text) = match self {
            Self::Constant { value } => (4, value.to_string()),
            Self::Dice { count, sides } => (4, format!("{count}d{sides}")),
            Self::Negate { value } => (3, format!("-{}", value.format(3))),
            Self::Binary {
                operator,
                left,
                right,
            } => {
                let (p, symbol) = match operator {
                    Operator::Add => (1, '+'),
                    Operator::Subtract => (1, '-'),
                    Operator::Multiply => (2, '*'),
                    Operator::Divide => (2, '/'),
                };
                (
                    p,
                    format!("{}{symbol}{}", left.format(p), right.format(p + 1)),
                )
            }
        };
        if precedence < minimum {
            format!("({text})")
        } else {
            text
        }
    }
}
struct Parser<'a> {
    text: &'a [u8],
    position: usize,
    nodes: usize,
    dice: u32,
}
impl Parser<'_> {
    fn peek(&mut self) -> Option<u8> {
        while self
            .text
            .get(self.position)
            .is_some_and(|b| *b == b' ' || *b == b'\t')
        {
            self.position += 1;
        }
        self.text.get(self.position).copied()
    }
    fn node(&mut self, node: Expr) -> Result<Expr, DiceError> {
        self.nodes += 1;
        if self.nodes > 64 {
            Err(DiceError::Limit)
        } else {
            Ok(node)
        }
    }
    fn number(&mut self) -> Result<u32, DiceError> {
        self.peek();
        let start = self.position;
        let mut number = 0u32;
        while let Some(b'0'..=b'9') = self.text.get(self.position) {
            number = number
                .checked_mul(10)
                .and_then(|v| v.checked_add((self.text[self.position] - b'0') as u32))
                .ok_or(DiceError::Limit)?;
            if number > 1_000_000 {
                return Err(DiceError::Limit);
            }
            self.position += 1;
        }
        if self.position == start {
            Err(DiceError::Syntax)
        } else {
            Ok(number)
        }
    }
    fn expression(&mut self, depth: usize) -> Result<Expr, DiceError> {
        let mut left = self.product(depth)?;
        while let Some(op @ (b'+' | b'-')) = self.peek() {
            self.position += 1;
            let right = self.product(depth)?;
            left = self.node(Expr::Binary {
                operator: if op == b'+' {
                    Operator::Add
                } else {
                    Operator::Subtract
                },
                left: Box::new(left),
                right: Box::new(right),
            })?;
        }
        Ok(left)
    }
    fn product(&mut self, depth: usize) -> Result<Expr, DiceError> {
        let mut left = self.unary(depth)?;
        while let Some(op @ (b'*' | b'/')) = self.peek() {
            self.position += 1;
            let right = self.unary(depth)?;
            left = self.node(Expr::Binary {
                operator: if op == b'*' {
                    Operator::Multiply
                } else {
                    Operator::Divide
                },
                left: Box::new(left),
                right: Box::new(right),
            })?;
        }
        Ok(left)
    }
    fn unary(&mut self, depth: usize) -> Result<Expr, DiceError> {
        if depth > 12 {
            return Err(DiceError::Limit);
        }
        match self.peek() {
            Some(sign @ (b'+' | b'-')) => {
                self.position += 1;
                let value = self.unary(depth + 1)?;
                if sign == b'-' {
                    self.node(Expr::Negate {
                        value: Box::new(value),
                    })
                } else {
                    Ok(value)
                }
            }
            Some(b'(') => {
                self.position += 1;
                let value = self.expression(depth + 1)?;
                if self.peek() != Some(b')') {
                    return Err(DiceError::Syntax);
                }
                self.position += 1;
                Ok(value)
            }
            _ => {
                let count = if matches!(self.peek(), Some(b'd' | b'D')) {
                    1
                } else {
                    self.number()?
                };
                if matches!(self.peek(), Some(b'd' | b'D')) {
                    self.position += 1;
                    let sides = self.number()?;
                    if count == 0 || sides == 0 || count > 100 {
                        return Err(DiceError::Limit);
                    }
                    self.dice += count;
                    if self.dice > 100 {
                        return Err(DiceError::Limit);
                    }
                    self.node(Expr::Dice { count, sides })
                } else {
                    self.node(Expr::Constant { value: count })
                }
            }
        }
    }
}
pub fn parse(text: &str) -> Result<Expr, DiceError> {
    if text.is_empty() || text.len() > 120 {
        return Err(DiceError::Limit);
    }
    if !text
        .bytes()
        .all(|b| b.is_ascii_digit() || b"dD+-*/() \t".contains(&b))
    {
        return Err(DiceError::Syntax);
    }
    let mut parser = Parser {
        text: text.as_bytes(),
        position: 0,
        nodes: 0,
        dice: 0,
    };
    let result = parser.expression(0)?;
    if parser.peek().is_some() {
        return Err(DiceError::Syntax);
    }
    Ok(result)
}
pub fn evaluate(
    ast: &Expr,
    sample: &mut impl FnMut(u32) -> Result<u32, DiceError>,
) -> Result<Evaluation, DiceError> {
    struct Work {
        nodes: u32,
        faces: u32,
        dice: Vec<DiceTerm>,
    }
    fn visit(
        ast: &Expr,
        sample: &mut impl FnMut(u32) -> Result<u32, DiceError>,
        work: &mut Work,
    ) -> Result<f64, DiceError> {
        work.nodes += 1;
        if work.nodes > 64 {
            return Err(DiceError::Limit);
        }
        let result = match ast {
            Expr::Constant { value } => {
                if *value > 1_000_000 {
                    return Err(DiceError::Limit);
                }
                *value as f64
            }
            Expr::Dice { count, sides } => {
                if *count == 0 || *count > 100 || *sides == 0 || *sides > 1_000_000 {
                    return Err(DiceError::Limit);
                }
                work.faces += count;
                if work.faces > 100 {
                    return Err(DiceError::Limit);
                }
                let mut faces = Vec::with_capacity(*count as usize);
                let mut subtotal = 0u64;
                for _ in 0..*count {
                    let face = sample(*sides)?;
                    if face == 0 || face > *sides {
                        return Err(DiceError::Arithmetic);
                    }
                    faces.push(face);
                    subtotal += face as u64;
                }
                work.dice.push(DiceTerm {
                    count: *count,
                    sides: *sides,
                    faces,
                    subtotal,
                });
                subtotal as f64
            }
            Expr::Negate { value } => -visit(value, sample, work)?,
            Expr::Binary {
                operator,
                left,
                right,
            } => {
                let left = visit(left, sample, work)?;
                let right = visit(right, sample, work)?;
                match operator {
                    Operator::Add => left + right,
                    Operator::Subtract => left - right,
                    Operator::Multiply => left * right,
                    Operator::Divide => {
                        if right == 0.0 {
                            return Err(DiceError::Arithmetic);
                        }
                        left / right
                    }
                }
            }
        };
        if !result.is_finite() || result.abs() > 1_000_000_000.0 {
            return Err(DiceError::Arithmetic);
        }
        Ok(result)
    }
    let mut work = Work {
        nodes: 0,
        faces: 0,
        dice: vec![],
    };
    let total = visit(ast, sample, &mut work)?;
    Ok(Evaluation {
        total,
        dice: work.dice,
    })
}
