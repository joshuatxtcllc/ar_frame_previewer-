// server/services/ReferralRewardsService.js
const moment = require(‘moment-timezone’);
const crypto = require(‘crypto’);
const { EventEmitter } = require(‘events’);

class ReferralRewardsService extends EventEmitter {
constructor(database, config = {}) {
super();
this.db = database;
this.timezone = config.timezone || ‘America/Chicago’;

```
// Reward tiers and rules
this.rewardTiers = {
  bronze: { minReferrals: 1, bonusMultiplier: 1.0, perks: ['5% discount'] },
  silver: { minReferrals: 3, bonusMultiplier: 1.2, perks: ['10% discount', 'priority scheduling'] },
  gold: { minReferrals: 5, bonusMultiplier: 1.5, perks: ['15% discount', 'priority scheduling', 'free consultation'] },
  platinum: { minReferrals: 10, bonusMultiplier: 2.0, perks: ['20% discount', 'priority scheduling', 'free consultation', 'expedited service'] }
};

this.rewardTypes = {
  percentage_discount: { type: 'discount', calculation: 'percentage' },
  fixed_discount: { type: 'discount', calculation: 'fixed' },
  credit: { type: 'credit', calculation: 'fixed' },
  free_service: { type: 'service', calculation: 'fixed' },
  upgrade: { type: 'upgrade', calculation: 'percentage' }
};

// Base reward amounts
this.baseRewards = {
  referrer: { type: 'credit', amount: 25 }, // $25 credit
  referee: { type: 'percentage_discount', amount: 10 } // 10% off first order
};

this.milestoneRewards = {
  3: { type: 'credit', amount: 100, bonus: 'silver_tier' },
  5: { type: 'credit', amount: 200, bonus: 'gold_tier' },
  10: { type: 'credit', amount: 500, bonus: 'platinum_tier' },
  25: { type: 'free_service', amount: 100, bonus: 'vip_status' }
};
```

}

async generateReferralCode(customerId, customCode = null) {
try {
// Check if customer already has an active referral code
const existingCode = await this.db(‘referral_codes’)
.where(‘customerId’, customerId)
.where(‘status’, ‘active’)
.first();

```
  if (existingCode) {
    return existingCode;
  }

  // Generate unique referral code
  const code = customCode || this.createReferralCode(customerId);
  
  // Verify uniqueness
  const codeExists = await this.db('referral_codes')
    .where('code', code)
    .first();

  if (codeExists) {
    throw new Error('Referral code already exists');
  }

  const referralCode = {
    id: require('uuid').v4(),
    customerId,
    code,
    status: 'active',
    usageCount: 0,
    maxUses: null, // Unlimited by default
    expiresAt: null, // No expiration by default
    createdAt: moment().toISOString(),
    updatedAt: moment().toISOString()
  };

  await this.db('referral_codes').insert(referralCode);

  this.emit('referralCodeGenerated', { customerId, code });

  return referralCode;

} catch (error) {
  console.error('Error generating referral code:', error);
  throw error;
}
```

}

createReferralCode(customerId) {
// Get customer info for personalization
const hash = crypto.createHash(‘md5’)
.update(customerId + Date.now().toString())
.digest(‘hex’)
.substring(0, 6)
.toUpperCase();

```
return `JF${hash}`; // Jay's Frames + unique hash
```

}

async processReferral(referralCode, newCustomerData) {
try {
// Validate referral code
const codeRecord = await this.db(‘referral_codes’)
.where(‘code’, referralCode)
.where(‘status’, ‘active’)
.first();

```
  if (!codeRecord) {
    throw new Error('Invalid or inactive referral code');
  }

  // Check if code has expired
  if (codeRecord.expiresAt && moment().isAfter(moment(codeRecord.expiresAt))) {
    throw new Error('Referral code has expired');
  }

  // Check usage limits
  if (codeRecord.maxUses && codeRecord.usageCount >= codeRecord.maxUses) {
    throw new Error('Referral code usage limit exceeded');
  }

  // Check if new customer already exists (prevent self-referrals and duplicates)
  const existingCustomer = await this.db('customers')
    .where('email', newCustomerData.email)
    .orWhere('phone', newCustomerData.phone)
    .first();

  if (existingCustomer) {
    // Check if it's the same customer trying to refer themselves
    if (existingCustomer.id === codeRecord.customerId) {
      throw new Error('Cannot refer yourself');
    }
    
    // Check if customer was already referred
    const existingReferral = await this.db('referrals')
      .where('referredCustomerId', existingCustomer.id)
      .first();

    if (existingReferral) {
      throw new Error('Customer has already been referred');
    }
  }

  // Create or get new customer
  let newCustomer = existingCustomer;
  if (!newCustomer) {
    newCustomer = {
      id: require('uuid').v4(),
      ...newCustomerData,
      referralSource: 'referral',
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString()
    };
    await this.db('customers').insert(newCustomer);
  }

  // Create referral record
  const referral = {
    id: require('uuid').v4(),
    referralCodeId: codeRecord.id,
    referrerCustomerId: codeRecord.customerId,
    referredCustomerId: newCustomer.id,
    status: 'pending', // Will be 'completed' when first order is placed
    referralDate: moment().toISOString(),
    completedAt: null,
    rewards: JSON.stringify({
      referrer: this.calculateReferrerReward(codeRecord.customerId),
      referee: this.calculateRefereeReward()
    }),
    createdAt: moment().toISOString(),
    updatedAt: moment().toISOString()
  };

  await this.db('referrals').insert(referral);

  // Update referral code usage
  await this.db('referral_codes')
    .where('id', codeRecord.id)
    .update({
      usageCount: codeRecord.usageCount + 1,
      updatedAt: moment().toISOString()
    });

  // Create pending rewards
  await this.createPendingRewards(referral);

  this.emit('referralProcessed', { 
    referral, 
    referrer: codeRecord.customerId, 
    referee: newCustomer.id 
  });

  return {
    referralId: referral.id,
    newCustomerId: newCustomer.id,
    rewards: JSON.parse(referral.rewards),
    message: 'Referral processed! Rewards will be activated after first purchase.'
  };

} catch (error) {
  console.error('Error processing referral:', error);
  throw error;
}
```

}

async calculateReferrerReward(referrerCustomerId) {
// Get referrer’s current tier and stats
const referrerStats = await this.getReferrerStats(referrerCustomerId);
const currentTier = this.determineCustomerTier(referrerStats.successfulReferrals);

```
const baseReward = { ...this.baseRewards.referrer };
baseReward.amount = Math.round(baseReward.amount * this.rewardTiers[currentTier].bonusMultiplier);
baseReward.tier = currentTier;

return baseReward;
```

}

async calculateRefereeReward() {
return { …this.baseRewards.referee };
}

async createPendingRewards(referral) {
const rewards = JSON.parse(referral.rewards);

```
// Referrer reward
await this.db('customer_rewards').insert({
  id: require('uuid').v4(),
  customerId: referral.referrerCustomerId,
  referralId: referral.id,
  type: rewards.referrer.type,
  amount: rewards.referrer.amount,
  description: `Referral reward for referring new customer`,
  status: 'pending',
  expiresAt: moment().add(1, 'year').toISOString(),
  createdAt: moment().toISOString()
});

// Referee reward
await this.db('customer_rewards').insert({
  id: require('uuid').v4(),
  customerId: referral.referredCustomerId,
  referralId: referral.id,
  type: rewards.referee.type,
  amount: rewards.referee.amount,
  description: `Welcome discount for being referred`,
  status: 'pending',
  expiresAt: moment().add(90, 'days').toISOString(), // 90 days to use
  createdAt: moment().toISOString()
});
```

}

async completeReferral(referralId, firstOrderId) {
try {
const referral = await this.db(‘referrals’)
.where(‘id’, referralId)
.first();

```
  if (!referral) {
    throw new Error('Referral not found');
  }

  if (referral.status === 'completed') {
    return referral;
  }

  // Update referral status
  await this.db('referrals')
    .where('id', referralId)
    .update({
      status: 'completed',
      completedAt: moment().toISOString(),
      firstOrderId,
      updatedAt: moment().toISOString()
    });

  // Activate rewards
  await this.db('customer_rewards')
    .where('referralId', referralId)
    .update({
      status: 'active',
      activatedAt: moment().toISOString()
    });

  // Check for milestone rewards
  await this.checkMilestoneRewards(referral.referrerCustomerId);

  // Update referrer statistics
  await this.updateReferrerStats(referral.referrerCustomerId);

  this.emit('referralCompleted', { 
    referralId, 
    referrer: referral.referrerCustomerId,
    referee: referral.referredCustomerId,
    firstOrderId 
  });

  return referral;

} catch (error) {
  console.error('Error completing referral:', error);
  throw error;
}
```

}

async checkMilestoneRewards(customerId) {
const stats = await this.getReferrerStats(customerId);
const milestones = Object.keys(this.milestoneRewards).map(Number).sort((a, b) => a - b);

```
for (const milestone of milestones) {
  if (stats.successfulReferrals >= milestone) {
    // Check if milestone reward already given
    const existingMilestone = await this.db('customer_rewards')
      .where('customerId', customerId)
      .where('type', 'milestone')
      .where('description', 'like', `%${milestone}%`)
      .first();

    if (!existingMilestone) {
      const reward = this.milestoneRewards[milestone];
      
      await this.db('customer_rewards').insert({
        id: require('uuid').v4(),
        customerId,
        type: 'milestone',
        rewardType: reward.type,
        amount: reward.amount,
        description: `Milestone reward for ${milestone} successful referrals`,
        status: 'active',
        activatedAt: moment().toISOString(),
        createdAt: moment().toISOString()
      });

      // Apply tier bonus if applicable
      if (reward.bonus && reward.bonus.includes('tier')) {
        await this.updateCustomerTier(customerId, reward.bonus.replace('_tier', ''));
      }

      this.emit('milestoneAchieved', { customerId, milestone, reward });
    }
  }
}
```

}

async updateReferrerStats(customerId) {
const stats = await this.getReferrerStats(customerId);

```
await this.db('customer_referral_stats')
  .insert({
    customerId,
    totalReferrals: stats.totalReferrals,
    successfulReferrals: stats.successfulReferrals,
    pendingReferrals: stats.pendingReferrals,
    totalRewardsEarned: stats.totalRewardsEarned,
    currentTier: this.determineCustomerTier(stats.successfulReferrals),
    lastUpdated: moment().toISOString()
  })
  .onConflict('customerId')
  .merge();
```

}

async getReferrerStats(customerId) {
const referralStats = await this.db.raw(`SELECT  COUNT(*) as totalReferrals, COUNT(CASE WHEN status = 'completed' THEN 1 END) as successfulReferrals, COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendingReferrals FROM referrals  WHERE referrerCustomerId = ?`, [customerId]);

```
const rewardStats = await this.db.raw(`
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as totalCredits,
    COALESCE(SUM(CASE WHEN status = 'used' THEN amount ELSE 0 END), 0) as usedRewards,
    COUNT(*) as totalRewards
  FROM customer_rewards 
  WHERE customerId = ?
`, [customerId]);

return {
  ...referralStats[0][0],
  ...rewardStats[0][0],
  totalRewardsEarned: rewardStats[0][0].totalCredits
};
```

}

determineCustomerTier(successfulReferrals) {
if (successfulReferrals >= this.rewardTiers.platinum.minReferrals) return ‘platinum’;
if (successfulReferrals >= this.rewardTiers.gold.minReferrals) return ‘gold’;
if (successfulReferrals >= this.rewardTiers.silver.minReferrals) return ‘silver’;
if (successfulReferrals >= this.rewardTiers.bronze.minReferrals) return ‘bronze’;
return ‘none’;
}

async getCustomerRewards(customerId, status = ‘active’) {
const rewards = await this.db(‘customer_rewards’)
.where(‘customerId’, customerId)
.where(‘status’, status)
.where(function() {
this.whereNull(‘expiresAt’)
.orWhere(‘expiresAt’, ‘>’, moment().toISOString());
})
.orderBy(‘createdAt’, ‘desc’);

```
return rewards.map(reward => ({
  ...reward,
  formattedAmount: this.formatRewardAmount(reward),
  timeUntilExpiry: reward.expiresAt ? 
    moment(reward.expiresAt).fromNow() : null
}));
```

}

formatRewardAmount(reward) {
switch (reward.type) {
case ‘credit’:
return `$${reward.amount}`;
case ‘percentage_discount’:
return `${reward.amount}%`;
case ‘fixed_discount’:
return `$${reward.amount} off`;
default:
return reward.amount.toString();
}
}

async applyRewardToOrder(customerId, orderId, rewardId) {
try {
const reward = await this.db(‘customer_rewards’)
.where(‘id’, rewardId)
.where(‘customerId’, customerId)
.where(‘status’, ‘active’)
.first();

```
  if (!reward) {
    throw new Error('Reward not found or not active');
  }

  // Check expiration
  if (reward.expiresAt && moment().isAfter(moment(reward.expiresAt))) {
    throw new Error('Reward has expired');
  }

  // Mark reward as used
  await this.db('customer_rewards')
    .where('id', rewardId)
    .update({
      status: 'used',
      usedAt: moment().toISOString(),
      usedOrderId: orderId
    });

  // Create reward application record
  await this.db('reward_applications').insert({
    id: require('uuid').v4(),
    rewardId,
    orderId,
    customerId,
    rewardType: reward.type,
    rewardAmount: reward.amount,
    appliedAt: moment().toISOString()
  });

  this.emit('rewardApplied', { rewardId, orderId, customerId, reward });

  return {
    success: true,
    rewardApplied: this.formatRewardAmount(reward),
    rewardType: reward.type
  };

} catch (error) {
  console.error('Error applying reward:', error);
  throw error;
}
```

}

async getReferralAnalytics(startDate, endDate) {
const analytics = await this.db.raw(`SELECT  DATE(referralDate) as date, COUNT(*) as total_referrals, COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_referrals, COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_referrals, AVG(CASE WHEN completedAt IS NOT NULL  THEN DATEDIFF(completedAt, referralDate)  ELSE NULL END) as avg_days_to_complete FROM referrals  WHERE DATE(referralDate) BETWEEN ? AND ? GROUP BY DATE(referralDate) ORDER BY date DESC`, [startDate, endDate]);

```
const rewardAnalytics = await this.db.raw(`
  SELECT 
    type,
    COUNT(*) as total_rewards,
    SUM(amount) as total_amount,
    COUNT(CASE WHEN status = 'used' THEN 1 END) as used_rewards,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_rewards,
    COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_rewards
  FROM customer_rewards 
  WHERE DATE(createdAt) BETWEEN ? AND ?
  GROUP BY type
`, [startDate, endDate]);

const topReferrers = await this.db.raw(`
  SELECT 
    c.firstName,
    c.lastName,
    c.email,
    COUNT(r.id) as total_referrals,
    COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as successful_referrals,
    COALESCE(SUM(cr.amount), 0) as total_rewards_earned
  FROM customers c
  JOIN referrals r ON c.id = r.referrerCustomerId
  LEFT JOIN customer_rewards cr ON c.id = cr.customerId
  WHERE DATE(r.referralDate) BETWEEN ? AND ?
  GROUP BY c.id, c.firstName, c.lastName, c.email
  ORDER BY successful_referrals DESC, total_rewards_earned DESC
  LIMIT 10
`, [startDate, endDate]);

return {
  dailyReferrals: analytics[0],
  rewardBreakdown: rewardAnalytics[0],
  topReferrers: topReferrers[0]
};
```

}

async expireOldRewards() {
const expiredRewards = await this.db(‘customer_rewards’)
.where(‘status’, ‘active’)
.where(‘expiresAt’, ‘<’, moment().toISOString());

```
for (const reward of expiredRewards) {
  await this.db('customer_rewards')
    .where('id', reward.id)
    .update({
      status: 'expired',
      expiredAt: moment().toISOString()
    });

  this.emit('rewardExpired', reward);
}

return expiredRewards.length;
```

}
}

module.exports = ReferralRewardsService;
