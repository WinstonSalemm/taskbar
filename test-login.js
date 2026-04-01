import dotenv from 'dotenv'
dotenv.config()

import { query } from './backend/db/index.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

async function testLogin() {
  try {
    console.log('🔐 Testing login...')
    const email = 'example@gmail.com'
    const password = '123'
    
    console.log('1. Searching for firm...')
    const firmResult = await query('SELECT * FROM firms WHERE email = $1', [email.toLowerCase()])
    console.log('   Firms found:', firmResult.rows.length)
    
    if (firmResult.rows.length === 0) {
      console.log('   ❌ Firm not found')
      return
    }
    
    const firm = firmResult.rows[0]
    console.log('   ✅ Firm:', firm.name)
    
    console.log('2. Searching for employees...')
    const employeeResult = await query('SELECT * FROM employees WHERE firm_id = $1', [firm.id])
    console.log('   Employees found:', employeeResult.rows.length)
    
    let employee = null
    for (const emp of employeeResult.rows) {
      console.log(`   Checking ${emp.name}: password="${emp.password}" vs input="${password}"`)
      const plainMatch = emp.password === password
      console.log(`   Plain match: ${plainMatch}`)
      
      if (plainMatch) {
        employee = emp
        break
      }
    }
    
    if (!employee) {
      console.log('   ❌ No employee with valid password')
      return
    }
    
    console.log('   ✅ Employee:', employee.name)
    
    const token = jwt.sign(
      { userId: employee.id, firmId: firm.id, role: 'employee' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    )
    
    console.log('✅ Login successful!')
    console.log('Token:', token)
    console.log('User:', {
      id: employee.id,
      name: employee.name,
      firmId: firm.id,
      firmName: firm.name,
      email: firm.email,
      role: 'employee'
    })
    
  } catch (err) {
    console.error('❌ Error:', err.message)
    console.error(err.stack)
  }
}

testLogin()
