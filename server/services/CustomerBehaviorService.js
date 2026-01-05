// server/services/CustomerBehaviorService.js
const tf = require('@tensorflow/tfjs-node');
const { Matrix } = require('ml-matrix');
const ss = require('simple-statistics');
const moment = require('moment-timezone');
const { EventEmitter } = require('events');

class CustomerBehaviorService extends EventEmitter {
constructor(database, config = {}) {
super();
this.db = database;
this.timezone = config.timezone || 'America/Chicago';

// Feature weights for recommendation algorithm
this.featureWeights = {
  frameStyle: 0.25,
  artworkType: 0.20,
  colorPreference: 0.15,
  sizeCategory: 0.15,
  priceRange: 0.10,
  matStyle: 0.10,
  glassType: 0.05
};

// Behavior patterns
this.behaviorPatterns = {
  frequent: { minOrders: 5, timeframe: 365 }, // 5+ orders in a year
  seasonal: { checkMonths: [3, 6, 9, 12] }, // Quarterly patterns
  valueSeeker: { discountThreshold: 0.1 }, // Uses 10%+ discounts
  premium: { avgOrderValue: 200 }, // $200+ average order
  quickDecision: { maxDaysToOrder: 3 }, // Orders within 3 days of inquiry
  loyal: { minYearsActive: 2, minOrders: 3 }
};

this.model = null;
this.isModelTrained = false;

}

async analyzeCustomerBehavior(customerId) {
try {
// Get customer's complete order history
const orders = await this.db('orders')
.where('customerId', customerId)
.orderBy('createdAt', 'desc');

  if (orders.length === 0) {
    return this.getNewCustomerProfile(customerId);
  }

  // Extract behavioral patterns
  const patterns = {
    orderFrequency: this.calculateOrderFrequency(orders),
    averageOrderValue: this.calculateAverageOrderValue(orders),
    preferredStyles: await this.extractStylePreferences(orders),
    priceRange: this.calculatePriceRange(orders),
    seasonalTrends: this.detectSeasonalTrends(orders),
    decisionSpeed: this.calculateDecisionSpeed(customerId, orders),
    brandLoyalty: this.calculateLoyaltyScore(orders),
    artworkTypes: this.extractArtworkTypePreferences(orders)
  };

  // Classify customer segments
  const segments = this.classifyCustomerSegment(patterns);

  // Calculate customer lifetime value
  const clv = this.calculateCustomerLifetimeValue(orders, patterns);

  // Predict next purchase
  const nextPurchasePrediction = await this.predictNextPurchase(customerId, patterns);

  const behaviorProfile = {
    customerId,
    patterns,
    segments,
    lifetimeValue: clv,
    nextPurchasePrediction,
    lastUpdated: moment().toISOString()
  };

  // Store behavior profile
  await this.storeBehaviorProfile(behaviorProfile);

  return behaviorProfile;

} catch (error) {
  console.error('Error analyzing customer behavior:', error);
  throw error;
}

}

calculateOrderFrequency(orders) {
if (orders.length < 2) return { frequency: 'new', ordersPerYear: 0 };

const firstOrder = moment(orders[orders.length - 1].createdAt);
const lastOrder = moment(orders[0].createdAt);
const daysBetween = lastOrder.diff(firstOrder, 'days');
const ordersPerYear = (orders.length / daysBetween) * 365;

let frequency;
if (ordersPerYear >= 12) frequency = 'very_frequent';
else if (ordersPerYear >= 6) frequency = 'frequent';
else if (ordersPerYear >= 3) frequency = 'occasional';
else frequency = 'rare';

return {
  frequency,
  ordersPerYear: Math.round(ordersPerYear * 10) / 10,
  totalOrders: orders.length,
  daysSinceLastOrder: moment().diff(lastOrder, 'days'),
  avgDaysBetweenOrders: Math.round(daysBetween / (orders.length - 1))
};

}

calculateAverageOrderValue(orders) {
const values = orders.map(o => parseFloat(o.totalAmount));
return {
average: Math.round(ss.mean(values) * 100) / 100,
median: Math.round(ss.median(values) * 100) / 100,
min: Math.min(...values),
max: Math.max(...values),
standardDeviation: Math.round(ss.standardDeviation(values) * 100) / 100
};
}

async extractStylePreferences(orders) {
const styles = {};
const colors = {};
const matStyles = {};

for (const order of orders) {
  const details = await this.db('order_details')
    .where('orderId', order.id)
    .first();

  if (details) {
    // Count frame styles
    const frameStyle = details.frameStyle || 'unknown';
    styles[frameStyle] = (styles[frameStyle] || 0) + 1;

    // Count colors
    const frameColor = details.frameColor || 'unknown';
    colors[frameColor] = (colors[frameColor] || 0) + 1;

    // Count mat styles
    const matStyle = details.matStyle || 'none';
    matStyles[matStyle] = (matStyles[matStyle] || 0) + 1;
  }
}

return {
  favoriteFrameStyle: this.getTopPreference(styles),
  favoriteColor: this.getTopPreference(colors),
  favoriteMatStyle: this.getTopPreference(matStyles),
  styleDistribution: styles,
  colorDistribution: colors,
  matDistribution: matStyles
};

}

getTopPreference(distribution) {
const entries = Object.entries(distribution);
if (entries.length === 0) return null;

entries.sort((a, b) => b[1] - a[1]);
return {
  value: entries[0][0],
  count: entries[0][1],
  percentage: Math.round((entries[0][1] / entries.reduce((sum, [, count]) => sum + count, 0)) * 100)
};

}

calculatePriceRange(orders) {
const values = orders.map(o => parseFloat(o.totalAmount));
const avg = ss.mean(values);

if (avg >= 300) return 'premium';
if (avg >= 150) return 'mid-range';
return 'budget';

}

detectSeasonalTrends(orders) {
const monthlyOrders = {};

orders.forEach(order => {
  const month = moment(order.createdAt).format('MM');
  monthlyOrders[month] = (monthlyOrders[month] || 0) + 1;
});

// Find peak months
const sortedMonths = Object.entries(monthlyOrders)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3);

return {
  peakMonths: sortedMonths.map(([month, count]) => ({
    month: moment(month, 'MM').format('MMMM'),
    orderCount: count
  })),
  monthlyDistribution: monthlyOrders,
  hasClearPattern: sortedMonths.length > 0 && sortedMonths[0][1] >= 3
};

}

async calculateDecisionSpeed(customerId, orders) {
// Get inquiries/quotes for this customer
const inquiries = await this.db('customer_inquiries')
.where('customerId', customerId)
.orderBy('createdAt', 'desc');

if (inquiries.length === 0) return null;

const decisionTimes = [];

for (const inquiry of inquiries) {
  const relatedOrder = orders.find(o => 
    moment(o.createdAt).diff(moment(inquiry.createdAt), 'days') <= 30
  );

  if (relatedOrder) {
    const days = moment(relatedOrder.createdAt).diff(moment(inquiry.createdAt), 'days');
    decisionTimes.push(days);
  }
}

if (decisionTimes.length === 0) return null;

const avgDecisionTime = ss.mean(decisionTimes);

return {
  averageDays: Math.round(avgDecisionTime * 10) / 10,
  speed: avgDecisionTime <= 3 ? 'fast' : avgDecisionTime <= 7 ? 'moderate' : 'slow',
  conversionRate: (decisionTimes.length / inquiries.length) * 100
};

}

calculateLoyaltyScore(orders) {
if (orders.length === 0) return 0;

const factors = {
  orderCount: Math.min(orders.length / 10, 1) * 30, // Max 30 points
  recency: this.calculateRecencyScore(orders) * 25, // Max 25 points
  consistency: this.calculateConsistencyScore(orders) * 20, // Max 20 points
  value: Math.min(this.calculateAverageOrderValue(orders).average / 200, 1) * 25 // Max 25 points
};

const totalScore = Object.values(factors).reduce((sum, score) => sum + score, 0);

return {
  score: Math.round(totalScore),
  factors,
  tier: this.getLoyaltyTier(totalScore)
};

}

calculateRecencyScore(orders) {
const daysSinceLastOrder = moment().diff(moment(orders[0].createdAt), 'days');

if (daysSinceLastOrder <= 30) return 1.0;
if (daysSinceLastOrder <= 90) return 0.8;
if (daysSinceLastOrder <= 180) return 0.5;
if (daysSinceLastOrder <= 365) return 0.3;
return 0.1;

}

calculateConsistencyScore(orders) {
if (orders.length < 3) return 0.5;

const intervals = [];
for (let i = 0; i < orders.length - 1; i++) {
  const days = moment(orders[i].createdAt).diff(moment(orders[i + 1].createdAt), 'days');
  intervals.push(days);
}

const cv = ss.standardDeviation(intervals) / ss.mean(intervals); // Coefficient of variation

// Lower CV = more consistent = higher score
if (cv <= 0.3) return 1.0;
if (cv <= 0.5) return 0.8;
if (cv <= 0.7) return 0.6;
return 0.4;

}

getLoyaltyTier(score) {
if (score >= 80) return 'champion';
if (score >= 60) return 'loyal';
if (score >= 40) return 'potential';
if (score >= 20) return 'new';
return 'at_risk';
}

extractArtworkTypePreferences(orders) {
const types = {};

orders.forEach(order => {
  const type = order.artworkType || 'unknown';
  types[type] = (types[type] || 0) + 1;
});

return {
  distribution: types,
  primary: this.getTopPreference(types),
  diversity: Object.keys(types).length
};

}

classifyCustomerSegment(patterns) {
const segments = [];

// Frequency-based segments
if (patterns.orderFrequency.frequency === 'very_frequent' || 
    patterns.orderFrequency.frequency === 'frequent') {
  segments.push('frequent_buyer');
}

// Value-based segments
if (patterns.priceRange === 'premium') {
  segments.push('premium_customer');
}

// Loyalty-based segments
if (patterns.brandLoyalty.tier === 'champion' || 
    patterns.brandLoyalty.tier === 'loyal') {
  segments.push('loyal_customer');
}

// Behavior-based segments
if (patterns.decisionSpeed && patterns.decisionSpeed.speed === 'fast') {
  segments.push('quick_decision_maker');
}

if (patterns.seasonalTrends.hasClearPattern) {
  segments.push('seasonal_buyer');
}

// Risk segments
if (patterns.orderFrequency.daysSinceLastOrder > 365) {
  segments.push('at_risk_churn');
}

return segments;

}

calculateCustomerLifetimeValue(orders, patterns) {
const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0);
const avgOrderValue = patterns.averageOrderValue.average;
const ordersPerYear = patterns.orderFrequency.ordersPerYear;

// Predict customer lifespan based on loyalty
const predictedLifespanYears = this.predictCustomerLifespan(patterns.brandLoyalty.tier);

// Calculate CLV
const predictedCLV = avgOrderValue * ordersPerYear * predictedLifespanYears;

return {
  historicalValue: Math.round(totalRevenue * 100) / 100,
  predictedLifetimeValue: Math.round(predictedCLV * 100) / 100,
  avgOrderValue,
  projectedOrdersPerYear: ordersPerYear,
  predictedLifespanYears
};

}

predictCustomerLifespan(loyaltyTier) {
const lifespanMap = {
champion: 5,
loyal: 3,
potential: 2,
new: 1,
at_risk: 0.5
};
return lifespanMap[loyaltyTier] || 1;
}

async predictNextPurchase(customerId, patterns) {
if (patterns.orderFrequency.ordersPerYear === 0) {
return null;
}

const avgDaysBetween = patterns.orderFrequency.avgDaysBetweenOrders;
const daysSinceLastOrder = patterns.orderFrequency.daysSinceLastOrder;

// Calculate probability based on time since last order
const expectedDays = avgDaysBetween;
const probability = this.calculatePurchaseProbability(daysSinceLastOrder, expectedDays);

// Predict likely date
const predictedDate = moment().add(Math.max(0, expectedDays - daysSinceLastOrder), 'days');

// Predict likely order characteristics
const predictedCharacteristics = {
  estimatedValue: patterns.averageOrderValue.average,
  likelyStyle: patterns.preferredStyles.favoriteFrameStyle?.value,
  likelyArtworkType: patterns.artworkTypes.primary?.value
};

return {
  probability: Math.round(probability * 100) / 100,
  expectedDate: predictedDate.format('YYYY-MM-DD'),
  daysUntilExpected: Math.max(0, expectedDays - daysSinceLastOrder),
  characteristics: predictedCharacteristics,
  confidence: this.calculatePredictionConfidence(patterns)
};

}

calculatePurchaseProbability(daysSince, expectedDays) {
// Bell curve probability distribution
const variance = expectedDays * 0.3; // 30% variance
const z = (daysSince - expectedDays) / variance;

// Using simplified normal distribution
let probability = Math.exp(-0.5 * z * z);

// Increase probability as we approach expected date
if (daysSince >= expectedDays * 0.8 && daysSince <= expectedDays * 1.2) {
  probability *= 1.5;
}

return Math.min(probability, 1.0);

}

calculatePredictionConfidence(patterns) {
let confidence = 0;

// More orders = higher confidence
if (patterns.orderFrequency.totalOrders >= 10) confidence += 30;
else if (patterns.orderFrequency.totalOrders >= 5) confidence += 20;
else confidence += 10;

// Consistency in ordering = higher confidence
if (patterns.brandLoyalty.factors.consistency >= 15) confidence += 25;
else if (patterns.brandLoyalty.factors.consistency >= 10) confidence += 15;

// Clear preferences = higher confidence
if (patterns.preferredStyles.favoriteFrameStyle?.percentage >= 50) confidence += 20;
else if (patterns.preferredStyles.favoriteFrameStyle?.percentage >= 30) confidence += 10;

// Recency = higher confidence
if (patterns.orderFrequency.daysSinceLastOrder <= 90) confidence += 25;
else if (patterns.orderFrequency.daysSinceLastOrder <= 180) confidence += 15;
else if (patterns.orderFrequency.daysSinceLastOrder <= 365) confidence += 5;

return Math.min(confidence, 100);

}

async generateRecommendations(customerId, context = {}) {
try {
const behaviorProfile = await this.analyzeCustomerBehavior(customerId);

  // Get all available products/frames
  const availableFrames = await this.db('frames')
    .where('status', 'active')
    .orderBy('popularity', 'desc');

  // Score each frame based on customer preferences
  const scoredFrames = availableFrames.map(frame => ({
    ...frame,
    score: this.calculateRecommendationScore(frame, behaviorProfile, context)
  }));

  // Sort by score and get top recommendations
  const topRecommendations = scoredFrames
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // Generate explanation for each recommendation
  const recommendations = topRecommendations.map(frame => ({
    frameId: frame.id,
    frameName: frame.name,
    style: frame.style,
    price: frame.price,
    score: Math.round(frame.score * 100) / 100,
    reasons: this.generateRecommendationReasons(frame, behaviorProfile),
    imageUrl: frame.imageUrl
  }));

  return {
    customerId,
    recommendations,
    basedOn: {
      orderHistory: behaviorProfile.patterns.orderFrequency.totalOrders,
      preferences: behaviorProfile.patterns.preferredStyles,
      confidence: behaviorProfile.nextPurchasePrediction?.confidence || 0
    },
    generatedAt: moment().toISOString()
  };

} catch (error) {
  console.error('Error generating recommendations:', error);
  throw error;
}

}

calculateRecommendationScore(frame, behaviorProfile, context) {
let score = 50; // Base score

const patterns = behaviorProfile.patterns;

// Style match
if (patterns.preferredStyles.favoriteFrameStyle?.value === frame.style) {
  score += this.featureWeights.frameStyle * 100;
}

// Color match
if (patterns.preferredStyles.favoriteColor?.value === frame.color) {
  score += this.featureWeights.colorPreference * 100;
}

// Price range compatibility
const customerPriceRange = patterns.averageOrderValue.average;
const priceDiff = Math.abs(frame.price - customerPriceRange) / customerPriceRange;

if (priceDiff <= 0.2) score += this.featureWeights.priceRange * 100; // Within 20%
else if (priceDiff <= 0.5) score += this.featureWeights.priceRange * 50; // Within 50%

// Popularity boost
score += (frame.popularity || 0) * 0.1;

// Context-based adjustments
if (context.artworkType && frame.recommendedFor?.includes(context.artworkType)) {
  score += 15;
}

if (context.size && this.isSizeCompatible(frame, context.size)) {
  score += 10;
}

// Diversity bonus (encourage trying new styles occasionally)
if (patterns.preferredStyles.favoriteFrameStyle?.value !== frame.style && 
    Math.random() > 0.7) {
  score += 5;
}

return score;

}

isSizeCompatible(frame, size) {
// Check if frame supports the requested size
return frame.availableSizes?.includes(size) || frame.customSizable;
}

generateRecommendationReasons(frame, behaviorProfile) {
const reasons = [];
const patterns = behaviorProfile.patterns;

if (patterns.preferredStyles.favoriteFrameStyle?.value === frame.style) {
  reasons.push(`Matches your preferred ${frame.style} style`);
}

if (patterns.preferredStyles.favoriteColor?.value === frame.color) {
  reasons.push(`Your favorite ${frame.color} color`);
}

const customerAvg = patterns.averageOrderValue.average;
if (Math.abs(frame.price - customerAvg) / customerAvg <= 0.2) {
  reasons.push('Within your typical price range');
}

if (frame.popularity >= 8) {
  reasons.push('Popular choice among customers');
}

if (patterns.artworkTypes.primary?.value && 
    frame.recommendedFor?.includes(patterns.artworkTypes.primary.value)) {
  reasons.push(`Perfect for ${patterns.artworkTypes.primary.value} artwork`);
}

if (reasons.length === 0) {
  reasons.push('Based on similar customer preferences');
}

return reasons;

}

async storeBehaviorProfile(profile) {
await this.db('customer_behavior_profiles')
.insert({
customerId: profile.customerId,
patterns: JSON.stringify(profile.patterns),
segments: JSON.stringify(profile.segments),
lifetimeValue: JSON.stringify(profile.lifetimeValue),
nextPurchasePrediction: JSON.stringify(profile.nextPurchasePrediction),
lastUpdated: profile.lastUpdated
})
.onConflict('customerId')
.merge();
}

async getNewCustomerProfile(customerId) {
return {
customerId,
patterns: {
orderFrequency: { frequency: 'new', ordersPerYear: 0, totalOrders: 0 },
isNewCustomer: true
},
segments: ['new_customer'],
lifetimeValue: { historicalValue: 0, predictedLifetimeValue: 0 },
nextPurchasePrediction: null
};
}

async getBehaviorInsights(customerId) {
const profile = await this.analyzeCustomerBehavior(customerId);

const insights = [];

// Generate actionable insights
if (profile.segments.includes('at_risk_churn')) {
  insights.push({
    type: 'warning',
    message: 'Customer hasn\'t ordered in over a year',
    action: 'Send re-engagement campaign with special offer',
    priority: 'high'
  });
}

if (profile.nextPurchasePrediction?.probability >= 0.7) {
  insights.push({
    type: 'opportunity',
    message: `High probability of purchase in next ${profile.nextPurchasePrediction.daysUntilExpected} days`,
    action: 'Send personalized recommendations',
    priority: 'medium'
  });
}

if (profile.segments.includes('premium_customer')) {
  insights.push({
    type: 'success',
    message: 'Premium customer with high lifetime value',
    action: 'Offer VIP benefits and exclusive previews',
    priority: 'medium'
  });
}

return {
  customerId,
  insights,
  profile
};

}
}

module.exports = CustomerBehaviorService;
