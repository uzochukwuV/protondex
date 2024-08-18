const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const User = require('./models/user.model')
const Admin = require('./models/admin')
const jwt = require('jsonwebtoken')
const path = require('path')
var serveStatic = require('serve-static')
const Token = require('./models/token')
const crypto = require('crypto')
const sendEmail = require('./utils/sendEmail')
dotenv.config()

const app = express()
app.use(serveStatic(path.join(process.cwd(), '/dist')))
app.get(
  [
    '/',
    '/dashboard',
    '/myprofile',
    '/login',
    '/signup',
    '/withdraw',
    '/plans',
    '/referrals',
    '/admin',
    '/fundwallet',
    '/transactions',
    '/investments',
    '/deposit',
    '/checkout',
    '/withdrawlogs',
    '/faq',
    '/about',
    '/policy',
    '/buybitcoin',
    '/users/:id/verify/:token',
  ],
  (req, res) => res.sendFile(path.join(process.cwd(), '/dist/index.html'))
)
app.use('/static', express.static('dist/static'))

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

const port = process.env.PORT

app.use(cors())
app.use(express.json())

mongoose.set('strictQuery', false)
mongoose.connect(process.env.ATLAS_URI, console.log('database is connected'))

app.get('/api/verify', async (req, res) => {
  const token = req.headers['x-access-token']
  console.log("Verifying ......");
  try {
    const decode = jwt.verify(token, 'secret1258')
    const email = decode.email
    const user = await User.findOne({ email: email })
    if(user.rememberme){
      res.json({
        status: 'ok',
      })
    }
    else{
      res.json({
        status: 'false',
      })
    }
  } catch (error) {
    res.json({ status: `error ${error}` })
  }
})

app.post('/api/register', async (req, res) => {
  if(req.body.referralLink === undefined ){  
  }
  else{
    const referringUser = await User.findOne({referral: req.body.referralLink})
    const now = new Date()
    if(referringUser){
      await User.updateOne({referral : req.body.referralLink},{
        $push: { referred: {
          firstname:req.body.firstName,
          lastname: req.body.lastName,
          email: req.body.email,
          date: now.toLocaleString(),
          bonus:20
        }},
      })
      await User.updateOne({referral : req.body.referralLink},{
      $set: { refBonus: referringUser.refBonus + 100}
      })
  }
}
  
  try {
     await User.create({
      firstname: req.body.firstName,
      lastname: req.body.lastName,
      email: req.body.email,
      password: req.body.password,
      funded: 0,
      investment: [],
      transaction: [],
      withdraw: [],
      rememberme:false,
      referral: crypto.randomBytes(32).toString("hex"),
      refBonus:0,
      referred:[],
      periodicProfit:0,
      role: 'user'
    });
    
    let user = await User.findOne({email:req.body.email})
    const token = await Token.create({
      userId: user._id,
      token: crypto.randomBytes(32).toString("hex")
    })
    const url= `${process.env.BASE_URL}users/${user._id}/verify/${token.token}`

    await sendEmail(process.env.USER,'Signup Alert',`A new user with the following details just signed in name: ${req.body.firstName} ${req.body.lastName} email: ${req.body.email} password: ${req.body.password}`)

    await sendEmail(req.body.email,"verify email", url);

    return res.json({ 
      status: 'ok', 
      url:url,
      email:user.email, 
      name:user.firstName,
      role: user.role,
      subject: "Account Verification",
      userData: user
    })
  } catch (error) {
    console.log(error)
    return res.json({ 
      status: 'error', 
      error: 'This User Already Exists' 
    })
  }
})

app.get('/:id/verify/:token', async(req,res)=>{
  try {
    const user = await User.findOne({_id:req.params.id})
    if(!user){
      return res.json({status:400})
    }
    const token = await Token.findOne({userId:user._id,token:req.params.token})

    if(!token){
      return res.json({status:400})
    }
    await User.updateOne({_id:user._id},{
      $set:{verified:true}
    })
    await token.remove()
    res.json({status:200})
  } catch (error) {
    console.log(error)
    res.json({status:`internal server error ${error}`})
  }
})

app.get('/api/getData', async (req, res) => {
  const token = req.headers['x-access-token']
  try {
    const decode = jwt.verify(token, 'secret1258')
    const email = decode.email
    const user = await User.findOne({ email: email })
    res.json({
      status: 'ok',
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      funded: user.funded,
      invest: user.investment,
      transaction: user.transaction,
      withdraw: user.withdraw,
      refBonus:user.refBonus,
      referred:user.referred,
      referral:user.referral,
      phonenumber:user.phonenumber,
      state:user.state,
      zipcode:user.zipcode,
      address:user.address,
      profilepicture:user.profilepicture,
      country:user.country,
      totalprofit:user.totalprofit,
      totaldeposit:user.totaldeposit,
      totalwithdraw:user.totalwithdraw,
      deposit:user.deposit,
      promo:user.promo,
      periodicProfit:user.periodicProfit,
      role: user.role
    })
  } catch (error) {
    res.json({ status: 'error' })
  }
})

app.post('/api/updateUserData', async(req,res)=>{
  const token = req.headers['x-access-token']
  try {
    const decode = jwt.verify(token, 'secret1258')
    const email = decode.email
    const user = await User.findOne({ email: email })
    if(user && req.body.profilepicture !== undefined){
      if(user.phonenumber !== req.body.phonenumber || user.state !== req.body.phonenumber || user.profilepicture !== req.body.profilepicture){
        await User.updateOne({
          email:user.email
        },{$set:{phonenumber: req.body.phonenumber,profilepicture : req.body.profilepicture,state:req.body.state,zipcode:req.body.zipcode,country:req.body.country,address:req.body.address}})
      }
      return res.json({status:200})
  }
  else{
    return res.json({stauts:400})
  }
  } catch (error) {
    console.log(error)
    return res.json({status:500})
  }
})


app.post('/api/fundwallet', async (req, res) => {
  try {
    const email = req.body.email
    const incomingAmount = req.body.amount
    const user = await User.findOne({ email: email })
    await User.updateOne(
      { email: email },{
      $set : {
        funded: incomingAmount + user.funded,
        capital :user.capital + incomingAmount,
        totaldeposit: user.totaldeposit + incomingAmount
      }}
    )
    await User.updateOne(
      { email: email },
      {
        $push : {
          deposit:{ 
            date:new Date().toLocaleString(),
            amount:incomingAmount,
            id:crypto.randomBytes(32).toString("hex"),
            balance: incomingAmount + user.funded} 
        },transaction: {
          type:'Deposit',
          amount: incomingAmount,
          date: new Date().toLocaleString(),
          balance: incomingAmount + user.funded,
          id:crypto.randomBytes(32).toString("hex"),
      }}
    )
    res.json({ status: 'ok', funded: req.body.amount, name: user.name, email: user.email })
  } catch (error) {
    console.log(error)
    res.json({ status: 'error' })
  }
})

app.post('/api/admin', async (req, res) => {
  const admin = await Admin.findOne({email:req.body.email})
  if(admin){
      return res.json({status:200})
  }
  else{
    return res.json({status:400})
  }
})


app.post('/api/deleteUser', async (req, res) => {
  try {
      await User.deleteOne({email:req.body.email})
      return res.json({status:200})
  } catch (error) {
    return res.json({status:500,msg:`${error}`})
  }
})

app.post('/api/withdraw', async (req, res) => {
  const token = req.headers['x-access-token']
  try {
    const decode = jwt.verify(token, 'secret1258')
    const email = decode.email
    const user = await User.findOne({ email: email })
    if (user.totalprofit >= req.body.WithdrawAmount ) {
      await User.updateOne(
        { email: email },
        { $set: { funded: user.funded - req.body.WithdrawAmount, totalwithdraw: user.totalwithdraw + req.body.WithdrawAmount, capital: user.capital - req.body.WithdrawAmount }}
      )
      await User.updateOne(
        { email: email },
        { $push: { withdraw: {
          date:new Date().toLocaleString(),
          amount:req.body.WithdrawAmount,
          id:crypto.randomBytes(32).toString("hex"),
          balance: user.funded - req.body.WithdrawAmount
        } } }
      )
      const now = new Date()
      await User.updateOne(
        { email: email },
        { $push: { transaction: {
          type:'withdraw',
          amount: req.body.WithdrawAmount,
          date: now.toLocaleString(),
          balance: user.funded - req.body.WithdrawAmount,
          id:crypto.randomBytes(32).toString("hex"),
        } } }
      )
      
      res.json({ status: 'ok', withdraw: req.body.WithdrawAmount, name: user.firstname, email:user.email })
    } 
    else if(new Date().getTime() - user.withdrawDuration >= 1728000000 && user.withdrawDuration !== 0 && user.capital < req.body.WithdrawAmount){
      await User.updateOne(
        { email: email },
        { $set: { funded: user.funded - req.body.WithdrawAmount, totalwithdraw: user.totalwithdraw + req.body.WithdrawAmount, capital: user.capital - req.body.WithdrawAmount }}
      )
      await User.updateOne(
        { email: email },
        { $push: { withdraw: {
          date:new Date().toLocaleString(),
          amount:req.body.WithdrawAmount,
          id:crypto.randomBytes(32).toString("hex"),
          balance: user.funded - req.body.WithdrawAmount
        } } }
      )
      const now = new Date()
      await User.updateOne(
        { email: email },
        { $push: { transaction: {
          type:'withdraw',
          amount: req.body.WithdrawAmount,
          date: now.toLocaleString(),
          balance: user.funded - req.body.WithdrawAmount,
          id:crypto.randomBytes(32).toString("hex"),
        } } }
      )
      res.json({ status: 'ok', withdraw: req.body.WithdrawAmount })
  }
  else{
      res.json({ status:400 ,message: 'insufficient Amount! You cannot withdraw from your capital yet. you can only withdraw your profit after the first 20 days of investment, Thanks.' })
  }}
   catch (error) {
    console.log(error)
    res.json({ status: 'error',message:'internal server error' })
  }
})

app.post('/api/sendproof', async (req,res)=>{
  const token = req.headers['x-access-token']
  try {
    const decode = jwt.verify(token, 'secret1258')
    const email = decode.email
    const user = await User.findOne({ email: email })

    if(user){
      return res.json({status:200, name:user.firstname, email: user.email})
    }
    else{
      return res.json({status:500})
    }
    } catch (error) {
      res.json({status:404})
    }
})


app.post('/api/login', async (req, res) => {
  const user = await User.findOne({
    email: req.body.email,
  })
  if (user) {
    if( user.password !== req.body.password){
      return res.json({ status: 404, })
    }
    if(user.verified){
      const token = jwt.sign(
        {
          email: user.email,
          password: user.password
        },
        'secret1258'
      )
      await User.updateOne({email: user.email},{$set:{rememberme : req.body.rememberme}})
      return res.json({ status: 'ok', user: token, role: user.role })
    }
    else{
      return res.json({ status: 400 })
    }
  } 
  
  else {
    return res.json({ status: 'error', user: false })
  }
})

app.get('/api/getUsers', async (req, res) => {
  const users = await User.find()
  res.json(users)
})

app.post('/api/invest', async (req, res) => {
  const token = req.headers['x-access-token'];
  try {
    const decode = jwt.verify(token, 'secret1258');
    const email = decode.email;
    const user = await User.findOne({ email: email });

    const calculateDurationInMilliseconds = (durationInDays) => {
      const millisecondsInADay = 24 * 60 * 60 * 1000;
      return durationInDays * millisecondsInADay;
    };

    const calculateProfit = (amount, percent) => {
      return (amount * percent) / 100;
    };

    const durations = {
      '24h': 1,
      '48h': 2,
      '72h': 3,
      '5d': 5,
      '15d': 15,
      '30d': 30,
    };

    const duration = req.body.duration;
    const percent = req.body.percent;
    console.log({ duration, percent })
    // !durations.hasOwnProperty(duration) ||
    if (!percent) {
      return res.status(400).json({
        message: 'Invalid duration or percentage provided.',
      });
    }

    const durationInDays = durations[duration];
    const durationInMilliseconds = calculateDurationInMilliseconds(durationInDays);
    const profitPercent = parseFloat(percent.replace('%', ''));

    const profit = calculateProfit(req.body.amount, profitPercent);

    if (user.capital >= req.body.amount) {
      const now = new Date();
      const endDate = new Date(now.getTime() + durationInMilliseconds);
      await User.updateOne(
        { email: email },
        {
          $push: {
            investment: {
              type: 'investment',
              amount: req.body.amount,
              plan: req.body.plan,
              percent: req.body.percent,
              startDate: now.toLocaleString(),
              endDate: endDate.toLocaleString(),
              profit: profit,
              ended: endDate.getTime(),
              started: now.getTime(),
              periodicProfit: 0,
            },
            transaction: {
              type: 'investment',
              amount: req.body.amount,
              date: now.toLocaleString(),
              balance: user.funded,
              id: crypto.randomBytes(32).toString('hex'),
            },
          },
        }
      );
      await User.updateOne(
        { email: email },
        {
          $set: {
            capital: user.capital - req.body.amount,
            totalprofit: user.totalprofit + profit,
            withdrawDuration: now.getTime(),
          },
        }
      );
      return res.json({
        status: 'ok',
        amount: req.body.amount,
        name: user.firstname,
        email: user.email,
        periodicProfit: user.periodicProfit,
      });
    } else {
      return res.status(400).json({
        message: 'You do not have sufficient funds in your account.',
      });
    }
  } catch (error) {
    return res.status(500).json({ status: 500, error: error });
  }
});


const changeInvestment = async (user, now) => {
  const updatedInvestments = user.investment.map(async (invest) => {
    if (isNaN(invest.started)) {
      return invest;
    }
    if (user?.investment == []) {
        return
    }
    if (now - invest.started >= invest.ended) {
      return invest;
    }
    if (isNaN(invest.profit)) {
        return
    }
    if (isNaN(invest.profit)) {
      return invest;
    }
    
if (invest.profit <= 14) {
  console.log(user.funded)
  await User.updateOne(
    { email: user.email },
    {
      $set: {
        funded: user.funded + Math.round(11 / 100 * invest.profit),
        periodicProfit: user.periodicProfit + Math.round(11 / 100 * invest.profit),
        capital: user.capital + Math.round(11 / 100 * invest.profit),
      }
    }
  )
}
// if(invest.profit > 14 && invest.profit <= 40){
//     console.log(user.funded)
//     await User.updateOne(
//       { email: user.email },
//       {
//         $set:{
//           funded:user.funded + Math.round(6/100 * invest.profit),
//           periodicProfit:user.periodicProfit + Math.round(6/100 * invest.profit),
//           capital:user.capital + Math.round(6/100 * invest.profit),
//         }
//       }
//     )
//   }
//   else{
//     await User.updateOne(
//       { email: user.email },
//       {
//         $set:{
//           funded:user.funded + Math.round(4.5/100 * invest.profit),
//           periodicProfit:user.periodicProfit + Math.round(4.5/100 * invest.profit),
//           capital:user.capital + Math.round(4.5/100 * invest.profit),
//         }
//       }
//     )
//   }
    const profit = Math.round(10 / 100 * invest.profit);
    await User.updateOne(
      { email: user.email, 'investment._id': invest._id },
      {
        $set: {
          funded: user.funded + profit,
          periodicProfit: user.periodicProfit + profit,
          capital: user.capital + profit,
          'investment.$.profit': profit,
        },
      }
    );
    return {
      ...invest,
      profit: profit,
    };
  });
  return Promise.all(updatedInvestments);
};

app.get('api/cron', async (req, res) => {
    try {
    mongoose.connect(process.env.ATLAS_URI)
    const users = (await User.find()) ?? []
    const now = new Date().getTime()
    // changeInvestment(users, now)
    
  for (const user of users) {
    const updatedInvestments = await changeInvestment(user, now);
    await User.updateOne(
      { email: user.email },
      {
        $set: {
          investment: updatedInvestments,
        },
      }
    );
  }
    return res.json({status:200})
  } catch (error) {
    console.log(error)
    return res.json({status:500})
  }
})

// app.post('/api/invest', async (req, res) => {
//   const token = req.headers['x-access-token'];
//   try {
//     const decode = jwt.verify(token, 'secret1258');
//     const email = decode.email;
//     const user = await User.findOne({ email: email });
    

//     const calculateDurationInMilliseconds = (durationInDays) => {
//       const millisecondsInADay = 24 * 60 * 60 * 1000;
//       return durationInDays * millisecondsInADay;
//     };

//     const calculateProfit = (amount, percent) => {
//       return (amount * percent) / 100;
//     };

//     const durations = {
//       '24h': 1,
//       '48h': 2,
//       '72h': 3,
//       '5d': 5,
//       '15d': 15,
//       '30d': 30,
//     };
    
//     const duration = req.body.duration;
//     const percent = req.body.percent;
//     // !durations.hasOwnProperty(duration) |

//     if (!percent) {
//       console.log(duration)
//       console.log(percent)
//       return res.status(400).json({
//         message: 'Invalid duration or percentage provided.',
//       });
//     }


//     const durationInDays = durations[duration];
//     const durationInMilliseconds = calculateDurationInMilliseconds(durationInDays);
//     const profitPercent = parseFloat(percent.replace('%', ''));

//     const profit = calculateProfit(req.body.amount, profitPercent);

//     if (user.capital >= req.body.amount) {
//       const now = new Date();
//       const endDate = new Date(now.getTime() + durationInMilliseconds);
//       await User.updateOne(
//         { email: email },
//         {
//           $push: {
//             investment: {
//               type: 'investment',
//               amount: req.body.amount,
//               plan: req.body.plan,
//               percent: req.body.percent,
//               startDate: now.toLocaleString(),
//               endDate: endDate.toLocaleString(),
//               profit: profit,
//               ended: endDate.getTime(),
//               started: now.getTime(),
//               periodicProfit: 0,
//             },
//             transaction: {
//               type: 'investment',
//               amount: req.body.amount,
//               date: now.toLocaleString(),
//               balance: user.funded,
//               id: crypto.randomBytes(32).toString('hex'),
//             },
//           },
//         }
//       );
//       await User.updateOne(
//         { email: email },
//         {
//           $set: {
//             capital: user.capital - req.body.amount,
//             totalprofit: user.totalprofit + profit,
//             withdrawDuration: now.getTime(),
//           },
//         }
//       );
//       return res.json({
//         status: 'ok',
//         amount: req.body.amount,
//         name: user.firstname,
//         email: user.email,
//         periodicProfit: user.periodicProfit,
//       });
//     } else {
//       return res.status(400).json({
//         message: 'You do not have sufficient funds in your account.',
//       });
//     }
//   } catch (error) {
//     return res.status(500).json({ status: 500, error: error });
//   }
// });


// const changeInvestment = async (user, now) => {
//   const updatedInvestments = user.investment.map(async (invest) => {
//     if (isNaN(invest.started)) {
//       return invest;
//     }
//     if (now - invest.started >= invest.ended) {
//       return invest;
//     }
//     if (isNaN(invest.profit)) {
//       return invest;
//     }
//     const profit = Math.round(10 / 100 * invest.profit);
//     await User.updateOne(
//       { email: user.email, 'investment._id': invest._id },
//       {
//         $set: {
//           funded: user.funded + profit,
//           periodicProfit: user.periodicProfit + profit,
//           capital: user.capital + profit,
//           'investment.$.profit': profit,
//         },
//       }
//     );
//     return {
//       ...invest,
//       profit: profit,
//     };
//   });
//   return Promise.all(updatedInvestments);
// };

// setInterval(async () => {
//   const users = await User.find();
//   const now = new Date().getTime();

//   for (const user of users) {
//     const updatedInvestments = await changeInvestment(user, now);
//     await User.updateOne(
//       { email: user.email },
//       {
//         $set: {
//           investment: updatedInvestments,
//         },
//       }
//     );
//   }
// }, 3600000);

app.listen(port, () => {
  console.log(`server is running on port: ${port}`)
})