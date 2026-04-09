// 通讯录管理模块
const CONTACT_STORAGE_KEYS = {
  CONTACTS: "qke_contacts",
  GROUPS: "qke_contact_groups",
  FAVORITES: "qke_contact_favorites",
  TAGS: "qke_contact_tags"
};

// 联系人数据模型
class Contact {
  constructor(id, name, phone, email, avatar, tags = [], groupId = null, isFavorite = false) {
    this.id = id;
    this.name = name;
    this.phone = phone;
    this.email = email || "";
    this.avatar = avatar || (name ? name.slice(0, 1) : "?");
    this.tags = tags;
    this.groupId = groupId;
    this.isFavorite = isFavorite;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.status = "offline"; // online, offline, busy, away
    this.lastSeen = null;
  }

  // 转换为Plain Object
  toObject() {
    return {
      id: this.id,
      name: this.name,
      phone: this.phone,
      email: this.email,
      avatar: this.avatar,
      tags: [...this.tags],
      groupId: this.groupId,
      isFavorite: this.isFavorite,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      status: this.status,
      lastSeen: this.lastSeen
    };
  }

  // 从Plain Object创建实例
  static fromObject(obj) {
    const contact = new Contact(
      obj.id,
      obj.name,
      obj.phone,
      obj.email,
      obj.avatar,
      obj.tags || [],
      obj.groupId || null,
      obj.isFavorite || false
    );
    contact.createdAt = obj.createdAt || Date.now();
    contact.updatedAt = obj.updatedAt || Date.now();
    contact.status = obj.status || "offline";
    contact.lastSeen = obj.lastSeen || null;
    return contact;
  }
}

// 联系人组数据模型
class ContactGroup {
  constructor(id, name, color = "#00d4ff") {
    this.id = id;
    this.name = name;
    this.color = color;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }

  toObject() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromObject(obj) {
    const group = new ContactGroup(obj.id, obj.name, obj.color);
    group.createdAt = obj.createdAt || Date.now();
    group.updatedAt = obj.updatedAt || Date.now();
    return group;
  }
}

// 通讯录管理器
class ContactManager {
  constructor() {
    this.contacts = new Map(); // id -> Contact
    this.groups = new Map(); // id -> ContactGroup
    this.favorites = new Set(); // 联系人ID集合
    this.tags = new Set(); // 标签集合
    this._loadFromStorage();
  }

  // 从localStorage加载数据
  _loadFromStorage() {
    try {
      // 加载联系人
      const contactsJson = localStorage.getItem(CONTACT_STORAGE_KEYS.CONTACTS);
      if (contactsJson) {
        const contactsArray = JSON.parse(contactsJson);
        contactsArray.forEach(contactObj => {
          const contact = Contact.fromObject(contactObj);
          this.contacts.set(contact.id, contact);
        });
      }

      // 加载分组
      const groupsJson = localStorage.getItem(CONTACT_STORAGE_KEYS.GROUPS);
      if (groupsJson) {
        const groupsArray = JSON.parse(groupsJson);
        groupsArray.forEach(groupObj => {
          const group = ContactGroup.fromObject(groupObj);
          this.groups.set(group.id, group);
        });
      }

      // 加载收藏夹
      const favoritesJson = localStorage.getItem(CONTACT_STORAGE_KEYS.FAVORITES);
      if (favoritesJson) {
        const favoritesArray = JSON.parse(favoritesJson);
        favoritesArray.forEach(id => this.favorites.add(id));
      }

      // 加载标签
      const tagsJson = localStorage.getItem(CONTACT_STORAGE_KEYS.TAGS);
      if (tagsJson) {
        const tagsArray = JSON.parse(tagsJson);
        tagsArray.forEach(tag => this.tags.add(tag));
      }
    } catch (error) {
      console.error("[ContactManager] 加载通讯录数据失败:", error);
      // 初始化一些默认数据
      this._initDefaultData();
    }
  }

  // 保存数据到localStorage
  _saveToStorage() {
    try {
      // 保存联系人
      const contactsArray = Array.from(this.contacts.values()).map(contact => contact.toObject());
      localStorage.setItem(CONTACT_STORAGE_KEYS.CONTACTS, JSON.stringify(contactsArray));

      // 保存分组
      const groupsArray = Array.from(this.groups.values()).map(group => group.toObject());
      localStorage.setItem(CONTACT_STORAGE_KEYS.GROUPS, JSON.stringify(groupsArray));

      // 保存收藏夹
      localStorage.setItem(CONTACT_STORAGE_KEYS.FAVORITES, JSON.stringify(Array.from(this.favorites)));

      // 保存标签
      localStorage.setItem(CONTACT_STORAGE_KEYS.TAGS, JSON.stringify(Array.from(this.tags)));
    } catch (error) {
      console.error("[ContactManager] 保存通讯录数据失败:", error);
    }
  }

  // 初始化默认数据
  _initDefaultData() {
    // 创建默认分组
    const defaultGroups = [
      new ContactGroup("group1", "我的好友", "#10b981"),
      new ContactGroup("group2", "同事", "#3b82f6"),
      new ContactGroup("group3", "家人", "#f59e0b"),
      new ContactGroup("group4", "其他", "#6b7280")
    ];

    defaultGroups.forEach(group => {
      this.groups.set(group.id, group);
    });

    // 创建一些示例联系人
    const sampleContacts = [
      new Contact("user1", "文件助手", "13800138000", "file@qke.com", "F", [], "group1", true),
      new Contact("user2", "产品经理", "13800138001", "pm@qke.com", "P", ["重要"], "group2"),
      new Contact("user3", "技术支持", "13800138002", "support@qke.com", "T", ["技术"], "group3")
    ];

    sampleContacts.forEach(contact => {
      this.contacts.set(contact.id, contact);
      if (contact.isFavorite) {
        this.favorites.add(contact.id);
      }
      contact.tags.forEach(tag => this.tags.add(tag));
    });

    this._saveToStorage();
  }

  // 联系人操作
  addContact(contact) {
    if (!contact.id) {
      contact.id = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    contact.updatedAt = Date.now();
    this.contacts.set(contact.id, contact);

    if (contact.isFavorite) {
      this.favorites.add(contact.id);
    }

    contact.tags.forEach(tag => this.tags.add(tag));

    this._saveToStorage();
    return contact.id;
  }

  updateContact(id, updates) {
    const contact = this.contacts.get(id);
    if (!contact) return false;

    Object.assign(contact, updates);
    contact.updatedAt = Date.now();
    this.contacts.set(id, contact);

    // 更新收藏夹状态
    if (updates.isFavorite !== undefined) {
      if (updates.isFavorite) {
        this.favorites.add(id);
      } else {
        this.favorites.delete(id);
      }
    }

    // 更新标签
    if (updates.tags !== undefined) {
      // 移除不再使用的标签
      const oldTags = new Set(contact.tags);
      const newTags = new Set(updates.tags);
      oldTags.forEach(tag => {
        if (!newTags.has(tag)) {
          // 检查是否还有其他联系人使用此标签
          let stillUsed = false;
          this.contacts.forEach(c => {
            if (c.id !== id && c.tags.includes(tag)) {
              stillUsed = true;
            }
          });
          if (!stillUsed) {
            this.tags.delete(tag);
          }
        }
      });
      // 添加新标签
      updates.tags.forEach(tag => this.tags.add(tag));
    }

    this._saveToStorage();
    return true;
  }

  deleteContact(id) {
    const contact = this.contacts.get(id);
    if (!contact) return false;

    // 删除前清理标签
    contact.tags.forEach(tag => {
      // 检查是否还有其他联系人使用此标签
      let stillUsed = false;
      this.contacts.forEach((c, cid) => {
        if (cid !== id && c.tags.includes(tag)) {
          stillUsed = true;
        }
      });
      if (!stillUsed) {
        this.tags.delete(tag);
      }
    });

    this.contacts.delete(id);
    this.favorites.delete(id);
    this._saveToStorage();
    return true;
  }

  getContact(id) {
    return this.contacts.get(id);
  }

  getAllContacts() {
    return Array.from(this.contacts.values());
  }

  searchContacts(query) {
    if (!query) return this.getAllContacts();

    const lowerQuery = query.toLowerCase();
    return this.getAllContacts().filter(contact =>
      contact.name.toLowerCase().includes(lowerQuery) ||
      contact.phone.includes(lowerQuery) ||
      contact.email.toLowerCase().includes(lowerQuery) ||
      contact.id.toLowerCase().includes(lowerQuery) ||
      contact.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  getContactsByGroup(groupId) {
    if (!groupId) return this.getAllContacts();
    return this.getAllContacts().filter(contact => contact.groupId === groupId);
  }

  getFavoriteContacts() {
    return this.getAllContacts().filter(contact => this.favorites.has(contact.id));
  }

  getContactsByTag(tag) {
    return this.getAllContacts().filter(contact => contact.tags.includes(tag));
  }

  // 分组操作
  addGroup(group) {
    if (!group.id) {
      group.id = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    group.updatedAt = Date.now();
    this.groups.set(group.id, group);
    this._saveToStorage();
    return group.id;
  }

  updateGroup(id, updates) {
    const group = this.groups.get(id);
    if (!group) return false;

    Object.assign(group, updates);
    group.updatedAt = Date.now();
    this.groups.set(id, group);
    this._saveToStorage();
    return true;
  }

  deleteGroup(id) {
    // 检查是否有联系人使用此分组
    const hasContacts = Array.from(this.contacts.values()).some(
      contact => contact.groupId === id
    );
    if (hasContacts) {
      // 将使用此分组的联系人设置为无分组
      this.contacts.forEach(contact => {
        if (contact.groupId === id) {
          contact.groupId = null;
          contact.updatedAt = Date.now();
        }
      });
    }

    this.groups.delete(id);
    this._saveToStorage();
    return true;
  }

  getGroup(id) {
    return this.groups.get(id);
  }

  getAllGroups() {
    return Array.from(this.groups.values());
  }

  // 标签操作
  addTag(tag) {
    if (tag && tag.trim()) {
      this.tags.add(tag.trim());
      this._saveToStorage();
    }
  }

  removeTag(tag) {
    this.tags.delete(tag);
    // 从所有联系人中移除此标签
    this.contacts.forEach(contact => {
      contact.tags = contact.tags.filter(t => t !== tag);
      contact.updatedAt = Date.now();
    });
    this._saveToStorage();
  }

  getAllTags() {
    return Array.from(this.tags);
  }

  // 收藏夹操作
  toggleFavorite(contactId) {
    if (this.favorites.has(contactId)) {
      this.favorites.delete(contactId);
      const contact = this.contacts.get(contactId);
      if (contact) {
        contact.isFavorite = false;
        contact.updatedAt = Date.now();
      }
    } else {
      this.favorites.add(contactId);
      const contact = this.contacts.get(contactId);
      if (contact) {
        contact.isFavorite = true;
        contact.updatedAt = Date.now();
      }
    }
    this._saveToStorage();
  }

  isFavorite(contactId) {
    return this.favorites.has(contactId);
  }

  // 状态更新
  updateContactStatus(contactId, status, lastSeen = null) {
    const contact = this.contacts.get(contactId);
    if (contact) {
      contact.status = status;
      contact.lastSeen = lastSeen || (status === "online" ? Date.now() : null);
      contact.updatedAt = Date.now();
      this._saveToStorage();
      return true;
    }
    return false;
  }

  // 批量操作
  batchUpdateContacts(contactIds, updates) {
    let successCount = 0;
    contactIds.forEach(id => {
      if (this.updateContact(id, updates)) {
        successCount++;
      }
    });
    return successCount;
  }

  batchDeleteContacts(contactIds) {
    let successCount = 0;
    contactIds.forEach(id => {
      if (this.deleteContact(id)) {
        successCount++;
      }
    });
    return successCount;
  }
}

// 创建全局通讯录管理器实例
const contactManager = new ContactManager();

// 导出供其他模块使用
window.contactManager = window.contactManager || contactManager;
if (typeof exports !== 'undefined' && exports !== null) {
  exports.ContactManager = ContactManager;
  exports.contactManager = contactManager;
}