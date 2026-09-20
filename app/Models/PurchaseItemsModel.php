<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseItemsModel extends Model
{
    protected $table = 'purchase_items';
    public function subplate()
    {
        return $this->belongsTo(SubplateModel::class, 'plateid'); 
    }
}